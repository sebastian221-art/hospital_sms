const { apiKey, sender } = require("../config/labsmobileConfig");
const db = require("../config/db");
require('dotenv').config();
const axios = require("axios");
const LabsMobileClient = require("labsmobile-sms/src/LabsMobileClient");
const LabsMobileModelTextMessage = require("labsmobile-sms/src/LabsMobileModelTextMessage");
const Blacklist = require("../models/Blacklist");



const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.sendReminderSMS = async () => {
    console.log("📢 Enviando recordatorio de citas...");
    try {
        const citas = await getCitasDelDiaSiguiente();
        console.log('📋 Citas obtenidas:', citas.length);
        if (citas.length === 0) {
            console.log('❌ No hay citas para enviar recordatorio.');
            return;
        }
        let count = 0;
        let bloqueados = 0;
        for (let cita of citas) {
            console.log(`📩 Procesando recordatorio para: ${cita.NOMBRE} con ${cita.PROFESIONAL}`);
            const fechaFormateada = new Date(cita.FECHA_CITA).toISOString().split('T')[0];
            const mensaje = `Hola ${cita.NOMBRE},recuerda tu cita ${cita.SERVICIO} el día ${fechaFormateada} hora ${cita.HORA_CITA},porfavor llega con 10 minutos de anticipación,te esperamos.`;
            let telefono = cita.TELEFONO_FIJO.replace(/\D/g, '');
            if (!telefono.startsWith('57')) {
                telefono = `57${telefono}`;
            }

            // Verificar si el número está en la lista negra
            const estaBloqueado = await Blacklist.estaEnBlacklist(telefono);
            if (estaBloqueado) {
                console.log(`🚫 Número bloqueado: ${cita.TELEFONO_FIJO} - No se enviará recordatorio`);
                bloqueados++;
                continue;
            }

            if (telefono.length >= 10) {
                try {
                    console.log(`📲 Enviando SMS a ${telefono}...`);
                    const apiUser = process.env.LABSMOBILE_USER;
                    const apiToken = process.env.LABSMOBILE_API_KEY;
                    const authHeader = 'Basic ' + Buffer.from(`${apiUser}:${apiToken}`).toString('base64');
                    const clientLabsMobile = new LabsMobileClient(apiUser, apiToken);
                    const bodySms = new LabsMobileModelTextMessage([telefono], mensaje);
                    const response = await clientLabsMobile.sendSms(bodySms);
                    console.log(response);
                    console.log(`✅ Recordatorio enviado a: ${cita.TELEFONO_FIJO}`);
                    console.log(response);
                    await db.query('UPDATE citas SET ESTADO = "Recordatorio enviado" WHERE ID = ?', [cita.ID]);
                } catch (error) {
                    console.error(`⚠️ Error al enviar SMS a ${cita.TELEFONO_FIJO}:`, error);
                }
            } else {
                console.log(`⚠️ Número inválido para la cita de ${cita.NOMBRE}`);
            }
            count++;
            if (count % 9 === 0) {
                console.log("⏳ Esperando 1 segundo para cumplir con el límite de LabsMobile...");
                await delay(1000);
            }
        }
        console.log(`🚀 Recordatorios procesados. Total: ${citas.length} | Bloqueados: ${bloqueados} | Enviados: ${count - bloqueados}`);
    } catch (error) {
        console.error('❌ Error al enviar recordatorios de citas:', error);
    }
};

async function getCitasDelDiaSiguiente() {
    const [rows] = await db.query('SELECT * FROM citas WHERE FECHA_CITA = CURDATE() + INTERVAL 1 DAY AND ESTADO = "pendiente"');
    return rows;
}


exports.sendManualSMS = async (req, res) => {
    console.log('📩 Datos recibidos:', req.body);
    const { nombre, correo, mensaje } = req.body;
    if (!nombre || !correo || !mensaje) {
        return res.status(400).json({ success: false, message: "Nombre, teléfono y mensaje son requeridos" });
    }
    try {
        let numeroFormateado = correo.replace(/\D/g, '');
        if (!numeroFormateado.startsWith('57')) {
            numeroFormateado = `57${numeroFormateado}`;
        }
        if (numeroFormateado.length < 10) {
            return res.status(400).json({ success: false, message: "Número de teléfono inválido" });
        }

        // Verificar si el número está en la lista negra
        const estaBloqueado = await Blacklist.estaEnBlacklist(numeroFormateado);
        if (estaBloqueado) {
            console.log(`🚫 Número bloqueado: ${correo} - No se enviará SMS`);
            return res.status(403).json({
                success: false,
                message: "Este número está en la lista negra y no puede recibir mensajes"
            });
        }

        console.log(`📲 Enviando SMS a ${correo}...`);
        const apiUser = process.env.LABSMOBILE_USER;
        const apiToken = process.env.LABSMOBILE_API_KEY;
        const clientLabsMobile = new LabsMobileClient(apiUser, apiToken);
        const bodySms = new LabsMobileModelTextMessage([numeroFormateado], mensaje);
        const response = await clientLabsMobile.sendSms(bodySms);
        console.log(response);

        console.log(`✅ SMS enviado a ${numeroFormateado}`, response);
        res.json({ success: true, message: `SMS enviado a ${correo}` });
    } catch (error) {
        console.error("⚠️ Error al enviar SMS:", error);
        res.status(500).json({ message: "Error interno al procesar la solicitud." });
    }
};



exports.getSaldoLabsMobile = async (req, res) => {
    try {
        const apiUser = process.env.LABSMOBILE_USER;
        const apiToken = process.env.LABSMOBILE_API_KEY;

        console.log("📢 API Key:", apiToken ? 'Presente' : 'No definida');

        if (!apiUser || !apiToken) {
            return res.status(400).json({ error: "Credenciales de API no configuradas" });
        }

        console.log("📢 Consultando saldo de LabsMobile");

        const authHeader = 'Basic ' + Buffer.from(`${apiUser}:${apiToken}`).toString('base64');

        const response = await axios.get("https://api.labsmobile.com/json/balance", {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log("📌 Respuesta completa:", JSON.stringify(response.data, null, 2));

        if (response.data && response.data.credits !== undefined) {
            return res.json({ saldo: response.data.credits });
        } else {
            return res.status(500).json({
                error: "No se pudo obtener el saldo de LabsMobile",
                responseData: response.data
            });
        }
    } catch (axiosError) {
        console.error("❌ Detalles completos del error de Axios:", {
            message: axiosError.message,
            code: axiosError.code,
            response: axiosError.response ? axiosError.response.data : 'No hay respuesta',
            status: axiosError.response ? axiosError.response.status : 'N/A'
        });

        return res.status(500).json({
            error: "Error al conectar con LabsMobile",
            detalle: axiosError.message,
            codigo: axiosError.code
        });
    }
};
exports.sendMasivoSMS = async (req, res) => {
    const { mensaje, telefonos } = req.body;

    if (!mensaje || !telefonos || !Array.isArray(telefonos) || telefonos.length === 0) {
        return res.status(400).json({ success: false, message: "Mensaje y lista de teléfonos son requeridos" });
    }

    const apiUser = process.env.LABSMOBILE_USER;
    const apiToken = process.env.LABSMOBILE_API_KEY;

    if (!apiUser || !apiToken) {
        return res.status(500).json({ success: false, message: "Credenciales de LabsMobile no configuradas" });
    }

    const clientLabsMobile = new LabsMobileClient(apiUser, apiToken);

    let enviados = 0;
    let fallidos = 0;
    let bloqueados = 0;
    const errores = [];

    // Responde inmediatamente y procesa en background
    res.json({
        success: true,
        message: `Iniciando envío masivo a ${telefonos.length} números...`,
        total: telefonos.length
    });

    for (let i = 0; i < telefonos.length; i++) {
        let telefono = String(telefonos[i]).replace(/\D/g, '');
        if (!telefono.startsWith('57')) telefono = '57' + telefono.slice(-10);

        if (telefono.length < 11) { fallidos++; continue; }

        try {
            const estaBloqueado = await Blacklist.estaEnBlacklist(telefono);
            if (estaBloqueado) { bloqueados++; continue; }

            const bodySms = new LabsMobileModelTextMessage([telefono], mensaje);
            await clientLabsMobile.sendSms(bodySms);
            enviados++;
            console.log(`✅ [${i+1}/${telefonos.length}] SMS enviado a ${telefono}`);
        } catch (error) {
            fallidos++;
            errores.push({ telefono, error: error.message });
            console.error(`⚠️ Error enviando a ${telefono}:`, error.message);
        }

        // Rate limit: pausa cada 9 mensajes
        if ((i + 1) % 9 === 0) {
            console.log(`⏳ Pausa rate limit... (${enviados} enviados)`);
            await delay(1000);
        }
    }

    console.log(`🚀 Envío masivo completado: ${enviados} enviados, ${fallidos} fallidos, ${bloqueados} bloqueados`);

    if (global.io) {
        global.io.emit('sms:masivo:completado', { enviados, fallidos, bloqueados, total: telefonos.length });
    }
};