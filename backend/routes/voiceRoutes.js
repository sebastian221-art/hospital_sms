const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const programarLlamadas = require('../controllers/programarllamadas');
const voiceMasivo = require('../controllers/voiceMasivoController');

// Rutas existentes
router.post('/programar-llamada', voiceController.programarLlamada);
router.get('/mensaje/:citaId', voiceController.manejarLlamada);
router.post('/mensaje/:citaId', voiceController.manejarLlamada);
router.post('/status-callback/:citaId', voiceController.actualizarEstadoLlamada);
router.post('/llamar-todos', programarLlamadas.programarLlamadasDelDiaSiguiente);

// Rutas masivo sin MySQL
router.post('/enviar-masivo', voiceMasivo.enviarLlamadasMasivas);
router.get('/mensaje-masivo/:callId', voiceMasivo.reproducirMensaje);
router.post('/mensaje-masivo/:callId', voiceMasivo.reproducirMensaje);
router.post('/status-masivo', voiceMasivo.statusCallback);

module.exports = router;