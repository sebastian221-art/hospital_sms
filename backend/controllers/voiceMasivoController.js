const twilio = require('twilio');
const { twiml } = require('twilio');
const VoiceResponse = twiml.VoiceResponse;

// Almacena mensajes en memoria (sin MySQL)
const mensajesEnMemoria = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Endpoint que Twilio llama para obtener el TwiML
exports.reproducirMensaje = (req, res) => {
    const callId = req.params.callId;
    const datos = mensajesEnMemoria.get(callId);

    const twimlResponse = new VoiceResponse();

    if (!datos) {
        twimlResponse.say({ voice: 'Google.es-US-Neural2-A', language: 'es-US' }, 'Hola, este es un mensaje de Jelcom.');
        twimlResponse.hangup();
        return res.status(200).set('Content-Type', 'text/xml').send(twimlResponse.toString());
    }

    twimlResponse.say(
        { voice: datos.voz || 'Google.es-US-Neural2-A', language: 'es-US', rate: '0.95' },
        datos.mensaje
    );
    twimlResponse.pause({ length: 1 });
    twimlResponse.hangup();

    res.status(200).set('Content-Type', 'text/xml').send(twimlResponse.toString());
};

// Endpoint principal de envío masivo
exports.enviarLlamadasMasivas = async (req, res) => {
    const { mensaje, telefonos, voz } = req.body;

    if (!mensaje || !telefonos || !Array.isArray(telefonos) || telefonos.length === 0) {
        return res.status(400).json({ success: false, message: 'Mensaje y lista de teléfonos son requeridos' });
    }

    const baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
        return res.status(500).json({ success: false, message: 'BASE_URL no configurada en .env' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioNumber) {
        return res.status(500).json({ success: false, message: 'Credenciales de Twilio no configuradas' });
    }

    const client = twilio(accountSid, authToken);

    // Generar ID único para esta campaña
    const callId = `campana_${Date.now()}`;
    mensajesEnMemoria.set(callId, { mensaje, voz: voz || 'Google.es-US-Neural2-A' });

    // Limpiar memoria después de 2 horas
    setTimeout(() => mensajesEnMemoria.delete(callId), 7200000);

    // Responder inmediatamente
    res.json({
        success: true,
        message: `Iniciando ${telefonos.length} llamadas...`,
        callId,
        total: telefonos.length
    });

    // Procesar en background
    let exitosas = 0, fallidas = 0, bloqueadas = 0;

    for (let i = 0; i < telefonos.length; i++) {
        let telefono = String(telefonos[i]).replace(/\D/g, '');
        if (!telefono.startsWith('57')) telefono = '57' + telefono.slice(-10);

        if (telefono.length < 11) { fallidas++; continue; }

        try {
            await client.calls.create({
                to: `+${telefono}`,
                from: twilioNumber,
                url: `${baseUrl}/api/voz/mensaje-masivo/${callId}`,
                statusCallback: `${baseUrl}/api/voz/status-masivo`,
                statusCallbackEvent: ['completed'],
                statusCallbackMethod: 'POST',
                timeout: 20,
                machineDetection: 'Enable',
            });

            exitosas++;
            console.log(`✅ [${i + 1}/${telefonos.length}] Llamada iniciada a +${telefono}`);

            if (global.io) {
                global.io.emit('voz:masivo:progreso', {
                    current: i + 1, total: telefonos.length,
                    exitosas, fallidas, bloqueadas,
                    telefono, porcentaje: (((i + 1) / telefonos.length) * 100).toFixed(1)
                });
            }

        } catch (error) {
            fallidas++;
            console.error(`❌ Error llamando a +${telefono}:`, error.message);
        }

        // Pausa entre llamadas para no saturar
        if (i < telefonos.length - 1) {
            await delay(1500);
        }
    }

    console.log(`🚀 Llamadas completadas: ${exitosas} exitosas, ${fallidas} fallidas`);

    if (global.io) {
        global.io.emit('voz:masivo:completado', { exitosas, fallidas, bloqueadas, total: telefonos.length });
    }

    // Limpiar mensaje de memoria al terminar
    mensajesEnMemoria.delete(callId);
};

exports.statusCallback = (req, res) => {
    console.log(`📞 Estado llamada: ${req.body.CallStatus} - ${req.body.To}`);
    res.status(204).end();
};