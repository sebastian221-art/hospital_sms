require("dotenv").config();
const axios = require("axios");
const XLSX = require("xlsx");
const path = require("path");

// ===== CONFIGURACIÓN =====
const TOKEN = process.env.WA_CAJASAN_TOKEN;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1140996105767673";
const TEMPLATE_NAME = "encuesta_ejercitate_cajasan";
const LANG_CODE = "es_CO";
const GRAPH = "https://graph.facebook.com/v21.0";

// Ruta del Excel de entrada (ponlo en la carpeta backend o ajusta la ruta)
const EXCEL_ENTRADA = path.join(__dirname, "base_encuestas_gimnasios.xlsx");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizar(tel) {
  let d = String(tel).replace(/\D/g, "");
  if (d.startsWith("57") && d.length === 12) return d;
  if (d.length >= 10) return "57" + d.slice(-10);
  return null;
}

async function main() {
  if (!TOKEN) {
    console.error("❌ Falta WA_CAJASAN_TOKEN en el .env");
    process.exit(1);
  }

  // Leer Excel
  const wb = XLSX.readFile(EXCEL_ENTRADA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  // Sacar celulares de la columna CELULAR (o variantes)
  const crudos = data
    .map((row) => row.CELULAR || row.Celular || row.celular || row.telefono || row.TELEFONO || "")
    .map(normalizar)
    .filter(Boolean);

  // Quitar duplicados
  const telefonos = [...new Set(crudos)];

  console.log(`📋 ${data.length} filas | ${telefonos.length} números únicos válidos`);
  console.log(`🚀 Iniciando envío de plantilla "${TEMPLATE_NAME}"...\n`);

  const reporte = [];
  let enviados = 0, fallidos = 0;
  const inicio = Date.now();

  for (let i = 0; i < telefonos.length; i++) {
    const to = telefonos[i];
    try {
      const resp = await axios.post(
        `${GRAPH}/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: { name: TEMPLATE_NAME, language: { code: LANG_CODE } },
        },
        { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
      );
      const wamid = resp.data?.messages?.[0]?.id || "";
      enviados++;
      reporte.push({ Telefono: to, Estado: "ENVIADO", WAMID: wamid, Error: "" });
      console.log(`✅ [${i + 1}/${telefonos.length}] ${to}`);
    } catch (e) {
      const err = e.response?.data?.error?.message || e.message;
      fallidos++;
      reporte.push({ Telefono: to, Estado: "FALLIDO", WAMID: "", Error: err });
      console.error(`❌ [${i + 1}/${telefonos.length}] ${to} → ${err}`);
    }
    await delay(150); // pausa suave entre envíos
  }

  // Generar Excel de reporte
  const wbOut = XLSX.utils.book_new();
  const wsOut = XLSX.utils.json_to_sheet(reporte);
  XLSX.utils.book_append_sheet(wbOut, wsOut, "Reporte");
  const fecha = new Date().toISOString().slice(0, 10);
  const salida = path.join(__dirname, `reporte_cajasan_${fecha}.xlsx`);
  XLSX.writeFile(wbOut, salida);

  const mins = ((Date.now() - inicio) / 60000).toFixed(1);
  console.log(`\n🏁 COMPLETADO en ${mins} min`);
  console.log(`   ✅ Enviados: ${enviados}`);
  console.log(`   ❌ Fallidos: ${fallidos}`);
  console.log(`   📊 Reporte: ${salida}`);
  process.exit(0);
}

main().catch((e) => { console.error("Error fatal:", e); process.exit(1); });