const express = require("express");
const router = express.Router();
const { sendManualSMS, sendReminderSMS, getSaldoLabsMobile, sendMasivoSMS } = require("../controllers/sms2controller");
const { verificarRol } = require("../middlewares/auth");

router.post("/enviar-sms", verificarRol(["admin", "usuario"]), sendManualSMS);
router.post("/enviar-masivo", verificarRol(["admin", "usuario"]), sendMasivoSMS);
router.post("/enviar", verificarRol(["admin", "usuario"]), async (req, res) => {
    try {
        const resultado = await sendReminderSMS();
        return res.json({ success: true, resultado });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error al enviar", error: error.message });
    }
});

// Sin verificarRol para el saldo
router.get("/saldo", getSaldoLabsMobile);

module.exports = router;