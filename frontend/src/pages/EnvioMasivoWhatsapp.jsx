import { useState, useEffect } from "react";
import { MessageCircle, Upload, X, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import io from "socket.io-client";
import { API_BASE_URL, SOCKET_BASE_URL } from "../config";

const EnvioMasivoWhatsapp = () => {
  const [cuentas, setCuentas] = useState([]);
  const [cuentaId, setCuentaId] = useState("");
  const [plantillas, setPlantillas] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("es_CO");
  const [telefonos, setTelefonos] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [stats, setStats] = useState(null);

  // Cargar cuentas + socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    axios.get(`${API_BASE_URL}/whatsapp-masivo/cuentas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCuentas(r.data.cuentas || []))
      .catch(() => setCuentas([]));

    const socket = io(SOCKET_BASE_URL, { transports: ["websocket", "polling"] });
    socket.on("whatsapp:masivo:progreso", (d) => setProgreso(d));
    socket.on("whatsapp:masivo:completado", (d) => { setStats(d); setLoading(false); });
    return () => socket.disconnect();
  }, []);

  // Al elegir cuenta, traer sus plantillas aprobadas
  const handleCuenta = async (id) => {
    setCuentaId(id);
    setTemplateName("");
    setPlantillas([]);
    if (!id) return;
    const cuenta = cuentas.find(c => String(c.id) === String(id));
    if (cuenta?.lang_default) setLanguageCode(cuenta.lang_default);
    try {
      const token = localStorage.getItem("token");
      const r = await axios.get(`${API_BASE_URL}/whatsapp-masivo/plantillas/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setPlantillas((r.data.plantillas || []).filter(p => p.status === "APPROVED"));
    } catch (e) {
      setResponse({ success: false, message: "No se pudieron cargar las plantillas: " + (e.response?.data?.message || e.message) });
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const nums = data.map(row =>
        row.CELULAR || row.Celular || row.celular || row.TELEFONO_FIJO ||
        row.telefono || row.TELEFONO || row.phone || ""
      ).filter(n => String(n).replace(/\D/g, "").length >= 10);
      // dedupe
      const unicos = [...new Set(nums.map(n => String(n).replace(/\D/g, "")))];
      setTelefonos(unicos);
    };
    reader.readAsBinaryString(file);
  };

  const handleEnviar = async () => {
    if (!cuentaId) return setResponse({ success: false, message: "Elige una cuenta de WhatsApp" });
    if (!templateName) return setResponse({ success: false, message: "Elige una plantilla aprobada" });
    if (telefonos.length === 0) return setResponse({ success: false, message: "Carga un Excel con teléfonos" });

    setLoading(true); setResponse(null); setProgreso(null); setStats(null);
    try {
      const token = localStorage.getItem("token");
      const r = await axios.post(`${API_BASE_URL}/whatsapp-masivo/enviar`,
        { cuentaId, templateName, languageCode, telefonos },
        { headers: { Authorization: `Bearer ${token}` } });
      setResponse({ success: true, message: r.data.message });
    } catch (e) {
      setLoading(false);
      setResponse({ success: false, message: e.response?.data?.message || "Error al enviar" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/30 p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="bg-green-500/20 p-3 rounded-full"><MessageCircle className="w-8 h-8 text-green-400" /></div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
            Envío Masivo WhatsApp
          </h2>
          <p className="text-gray-400 mt-1 text-sm">Plantillas aprobadas por Meta · Multi-empresa</p>
        </div>

        {/* Cuenta */}
        <div className="mb-4">
          <label className="text-gray-300 block mb-2 text-sm font-medium">🏢 Empresa / Cuenta WhatsApp</label>
          <select value={cuentaId} onChange={(e) => handleCuenta(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
            <option value="">Selecciona una cuenta...</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.display_phone ? `(${c.display_phone})` : ""}</option>)}
          </select>
        </div>

        {/* Plantilla */}
        {cuentaId && (
          <div className="mb-4">
            <label className="text-gray-300 block mb-2 text-sm font-medium">📋 Plantilla aprobada</label>
            <select value={templateName} onChange={(e) => {
              setTemplateName(e.target.value);
              const p = plantillas.find(x => x.name === e.target.value);
              if (p?.language) setLanguageCode(p.language);
            }}
              className="w-full p-3 rounded-xl bg-slate-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
              <option value="">{plantillas.length ? "Selecciona una plantilla..." : "Sin plantillas aprobadas"}</option>
              {plantillas.map(p => <option key={p.name} value={p.name}>{p.name} ({p.language})</option>)}
            </select>
          </div>
        )}

        {/* Excel */}
        <div className="mb-4">
          <label className="text-gray-300 block mb-2 text-sm font-medium">📂 Excel con teléfonos</label>
          {!fileName ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-green-500/30 rounded-xl p-5 cursor-pointer hover:border-green-500/60 transition-all">
              <Upload className="w-8 h-8 text-green-400 mb-2" />
              <span className="text-green-300 text-sm">Haz clic para subir .xlsx</span>
              <span className="text-gray-500 text-xs mt-1">Columnas: CELULAR, Celular, telefono...</span>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3 border border-slate-600">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-white text-sm font-medium">{fileName}</p>
                  <p className="text-green-400 text-xs">✅ {telefonos.length.toLocaleString()} números únicos</p>
                </div>
              </div>
              <button onClick={() => { setTelefonos([]); setFileName(""); }} className="text-gray-400 hover:text-red-400"><X className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        {/* Resumen */}
        {telefonos.length > 0 && templateName && (
          <div className="bg-slate-700/30 rounded-xl p-3 mb-4 border border-slate-600/50">
            <p className="text-gray-300 text-sm">📱 <strong className="text-white">{telefonos.length.toLocaleString()}</strong> mensajes a enviar</p>
            <p className="text-gray-300 text-sm mt-1">💰 Costo aprox: <strong className="text-green-400">~${(telefonos.length * 0.014).toFixed(2)} USD</strong> (marketing Colombia)</p>
          </div>
        )}

        <button onClick={handleEnviar} disabled={loading || !cuentaId || !templateName || telefonos.length === 0}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</> : <><MessageCircle className="w-5 h-5" /> Enviar {telefonos.length > 0 ? telefonos.length.toLocaleString() : ""} WhatsApp</>}
        </button>

        {response && (
          <div className={`p-4 mt-4 rounded-xl flex items-center gap-3 border ${response.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {response.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm">{response.message}</span>
          </div>
        )}

        {progreso && (
          <div className="mt-4 bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
            <div className="flex justify-between mb-2">
              <span className="text-white text-sm font-medium">Progreso</span>
              <span className="text-green-400 text-sm">{progreso.porcentaje}%</span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-2 mb-3">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progreso.porcentaje}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-800 rounded-lg p-2"><p className="text-green-400 font-bold">{progreso.enviados}</p><p className="text-gray-500 text-xs">Enviados</p></div>
              <div className="bg-slate-800 rounded-lg p-2"><p className="text-red-400 font-bold">{progreso.fallidos}</p><p className="text-gray-500 text-xs">Fallidos</p></div>
              <div className="bg-slate-800 rounded-lg p-2"><p className="text-white font-bold">{progreso.current}/{progreso.total}</p><p className="text-gray-500 text-xs">Total</p></div>
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-4 bg-green-500/10 rounded-xl p-4 border border-green-500/20">
            <p className="text-white font-medium mb-2">🏁 Envío completado</p>
            <p className="text-green-400 text-sm">✅ Enviados: {stats.enviados}</p>
            <p className="text-red-400 text-sm">❌ Fallidos: {stats.fallidos}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnvioMasivoWhatsapp;