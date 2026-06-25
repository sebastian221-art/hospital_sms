import { useState, useEffect } from "react";
import { Phone, Upload, X, Loader2, CheckCircle, AlertCircle, Mic } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import io from "socket.io-client";
import { API_BASE_URL, SOCKET_BASE_URL } from "../config";

const VOCES = [
    { id: "Google.es-US-Neural2-A", label: "Femenina Latino (Neural2-A) ⭐ Recomendada" },
    { id: "Google.es-US-Neural2-B", label: "Masculina Latino (Neural2-B)" },
    { id: "Google.es-US-Neural2-C", label: "Masculina Latino (Neural2-C)" },
    { id: "Google.es-ES-Neural2-A", label: "Femenina España (Neural2-A)" },
    { id: "Google.es-ES-Neural2-F", label: "Masculina España (Neural2-F)" },
];

const EnvioMasivoVoz = () => {
    const [mensaje, setMensaje] = useState("");
    const [telefonos, setTelefonos] = useState([]);
    const [fileName, setFileName] = useState("");
    const [vozSeleccionada, setVozSeleccionada] = useState("Google.es-US-Neural2-A");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [progreso, setProgreso] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const socket = io(SOCKET_BASE_URL, { transports: ["websocket", "polling"] });

        socket.on("voz:masivo:progreso", (data) => {
            setProgreso(data);
        });

        socket.on("voz:masivo:completado", (data) => {
            setStats(data);
            setLoading(false);
        });

        return () => socket.disconnect();
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);

            const nums = data.map(row =>
                row.TELEFONO_FIJO || row.Celular || row.celular ||
                row.telefono || row.TELEFONO || row.phone || ""
            ).filter(n => String(n).replace(/\D/g, "").length >= 10);

            setTelefonos(nums);
        };
        reader.readAsBinaryString(file);
    };

    const handleEnviar = async () => {
        if (!mensaje.trim()) return setResponse({ success: false, message: "Escribe el mensaje a reproducir" });
        if (telefonos.length === 0) return setResponse({ success: false, message: "Carga un archivo Excel con teléfonos" });

        setLoading(true);
        setResponse(null);
        setProgreso(null);
        setStats(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_BASE_URL}/voz/enviar-masivo`,
                { mensaje, telefonos, voz: vozSeleccionada },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setResponse({ success: true, message: res.data.message });
        } catch (error) {
            setLoading(false);
            setResponse({ success: false, message: error.response?.data?.message || "Error al iniciar llamadas" });
        }
    };

    const tiempoEstimado = Math.ceil(telefonos.length * 1.5 / 60);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/30 p-8">

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-3">
                        <div className="bg-orange-500/20 p-3 rounded-full">
                            <Phone className="w-8 h-8 text-orange-400" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                        Envío Masivo de Voz
                    </h2>
                    <p className="text-gray-400 mt-1 text-sm">Llamadas automáticas con mensaje personalizado</p>
                </div>

                {/* Selección de voz */}
                <div className="mb-4">
                    <label className="text-gray-300 block mb-2 text-sm font-medium flex items-center gap-2">
                        <Mic className="w-4 h-4 text-orange-400" /> Voz a utilizar
                    </label>
                    <select
                        value={vozSeleccionada}
                        onChange={(e) => setVozSeleccionada(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    >
                        {VOCES.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </select>
                </div>

                {/* Cargar Excel */}
                <div className="mb-4">
                    <label className="text-gray-300 block mb-2 text-sm font-medium">📂 Archivo Excel con teléfonos</label>
                    {!fileName ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-orange-500/30 rounded-xl p-5 cursor-pointer hover:border-orange-500/60 transition-all">
                            <Upload className="w-8 h-8 text-orange-400 mb-2" />
                            <span className="text-orange-300 text-sm">Haz clic para subir .xlsx</span>
                            <span className="text-gray-500 text-xs mt-1">Columnas aceptadas: TELEFONO_FIJO, Celular, telefono</span>
                            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                        </label>
                    ) : (
                        <div className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3 border border-slate-600">
                            <div>
                                <p className="text-white text-sm font-medium">{fileName}</p>
                                <p className="text-green-400 text-xs mt-1">✅ {telefonos.length.toLocaleString()} teléfonos cargados</p>
                            </div>
                            <button onClick={() => { setTelefonos([]); setFileName(""); }} className="text-gray-400 hover:text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Mensaje */}
                <div className="mb-4">
                    <label className="text-gray-300 block mb-2 text-sm font-medium">🎙️ Mensaje a reproducir en la llamada</label>
                    <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        className="w-full p-3 h-32 rounded-xl bg-slate-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                        placeholder="Escribe el mensaje que se reproducirá automáticamente cuando la persona conteste..."
                    />
                    <p className="text-gray-500 text-xs mt-1">{mensaje.length} caracteres</p>
                </div>

                {/* Resumen */}
                {telefonos.length > 0 && mensaje.trim() && (
                    <div className="bg-slate-700/30 rounded-xl p-3 mb-4 border border-slate-600/50">
                        <p className="text-gray-300 text-sm">📞 <strong className="text-white">{telefonos.length.toLocaleString()}</strong> llamadas a realizar</p>
                        <p className="text-gray-300 text-sm mt-1">⏱️ Tiempo estimado: <strong className="text-white">~{tiempoEstimado} minutos</strong></p>
                        <p className="text-gray-300 text-sm mt-1">💰 Costo aprox: <strong className="text-orange-400">~${(telefonos.length * 0.0312).toFixed(2)} USD</strong></p>
                    </div>
                )}

                {/* Botón */}
                <button
                    onClick={handleEnviar}
                    disabled={loading || telefonos.length === 0 || !mensaje.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Enviando llamadas...</>
                    ) : (
                        <><Phone className="w-5 h-5" /> Iniciar {telefonos.length > 0 ? telefonos.length.toLocaleString() : ""} Llamadas</>
                    )}
                </button>

                {/* Respuesta inicial */}
                {response && (
                    <div className={`p-4 mt-4 rounded-xl flex items-center gap-3 border ${response.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                        {response.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                        <span className="text-sm">{response.message}</span>
                    </div>
                )}

                {/* Progreso en tiempo real */}
                {progreso && (
                    <div className="mt-4 bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                        <div className="flex justify-between mb-2">
                            <span className="text-white text-sm font-medium">Progreso</span>
                            <span className="text-orange-400 text-sm">{progreso.porcentaje}%</span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-2 mb-3">
                            <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${progreso.porcentaje}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-800 rounded-lg p-2">
                                <p className="text-green-400 font-bold">{progreso.exitosas}</p>
                                <p className="text-gray-500 text-xs">Exitosas</p>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-2">
                                <p className="text-red-400 font-bold">{progreso.fallidas}</p>
                                <p className="text-gray-500 text-xs">Fallidas</p>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-2">
                                <p className="text-white font-bold">{progreso.current}/{progreso.total}</p>
                                <p className="text-gray-500 text-xs">Total</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Completado */}
                {stats && (
                    <div className="mt-4 bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                        <p className="text-white font-medium mb-2">🏁 Envío completado</p>
                        <p className="text-green-400 text-sm">✅ Exitosas: {stats.exitosas}</p>
                        <p className="text-red-400 text-sm">❌ Fallidas: {stats.fallidas}</p>
                        <p className="text-gray-400 text-sm">📊 Total: {stats.total}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnvioMasivoVoz;