require("dotenv").config();
const axios = require("axios");

// ===== CONFIGURACIÓN =====
const TOKEN = process.env.WA_CAJASAN_TOKEN;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1140996105767673";
const TEMPLATE_NAME = "encuesta_ejercitate_cajasan";
const LANG_CODE = "es_CO";
const GRAPH = "https://graph.facebook.com/v21.0";

// 👉 TU NÚMERO DE PRUEBA (ya normalizado a 57...)
const NUMERO_PRUEBA = "573154559242";

async function probar() {
  if (!TOKEN) {
    console.error("❌ Falta WA_CAJASAN_TOKEN en el .env");
    process.exit(1);
  }

  console.log(`📲 Enviando plantilla "${TEMPLATE_NAME}" a ${NUMERO_PRUEBA}...`);

  try {
    const resp = await axios.post(
      `${GRAPH}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: NUMERO_PRUEBA,
        type: "template",
        template: { name: TEMPLATE_NAME, language: { code: LANG_CODE } },
      },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
    );

    const wamid = resp.data?.messages?.[0]?.id || "(sin id)";
    console.log("✅ Mensaje aceptado por Meta");
    console.log("   WAMID:", wamid);
    console.log("   Revisa tu WhatsApp en unos segundos 📱");
  } catch (e) {
    const err = e.response?.data?.error;
    console.error("❌ Error al enviar:");
    console.error("   Mensaje:", err?.message || e.message);
    if (err?.code) console.error("   Código:", err.code);
    if (err?.error_data?.details) console.error("   Detalle:", err.error_data.details);
  }
  process.exit(0);
}

probar();