import { useState, useEffect } from "react";
import { getSMSBalance } from "../services/smsService";
import { MessageCircle, Loader2, CheckCircle, AlertCircle, Upload, X } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../config";

const SendSMS = () => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [balance, setBalance] = useState(null);
    const [errorBalance, setErrorBalance] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [telefonos, setTelefonos] = useState([]);
    const [fileName, setFileName] = useState("");
    const [progreso, setProgreso] = useState(null);

    useEffect(() => {
        fetchBalance();

        // Escuchar progreso por socket
        if (window.socket) {
            window.socket.on("sms:masivo:completado", (data) => {
                setProgreso(data);
                fetchBalance();
            });
        }
    }, []);

    const fetchBalance = async () => {
        const result = await getSMSBalance();
        if (result.success) {
            setBalance(result.balance);
            setErrorBalance(false);
        } else {
            setBalance(0);
            setErrorBalance(true);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);

            // Buscar columna de teléfono (acepta TELEFONO_FIJO, Celular, telefono, etc.)
            const nums = data.map(row => {
                return row.TELEFONO_FIJO || row.Celular || row.celular ||
                       row.telefono || row.TELEFONO || row.phone || "";
            }).filter(n => String(n).replace(/\D/g, "").length >= 10);

            setTelefonos(nums);
        };
        reader.readAsBinaryString(file);
    };

    const handleEliminarArchivo = () => {
        setTelefonos([]);
        setFileName("");
    };

    const handleEnviar = async () => {
        if (!mensaje.trim()) {
            setResponse({ success: false, message: "Escribe el mensaje a enviar" });
            return;
        }
        if (telefonos.length === 0) {
            setResponse({ success: false, message: "Carga un archivo Excel con los teléfonos" });
            return;
        }

        setLoading(true);
        setResponse(null);
        setProgreso(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_BASE_URL}/sms/enviar-masivo`,
                { mensaje, telefonos },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setResponse({ success: true, message: res.data.message });
        } catch (error) {
            setResponse({ success: false, message: error.response?.data?.message || "Error al enviar" });
        } finally {
            setLoading(false);
        }
    };

    const caracteresRestantes = 160 - mensaje.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/30 p-8">

                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                        Envío Masivo SMS
                    </h2>
                    <p className="text-gray-400 mt-1 text-sm">Carga tu lista y escribe el mensaje</p>
                </div>

                {/* Saldo */}
                <div className={`mb-4 text-center text-base font-medium ${errorBalance ? "text-red-400" : "text-orange-400"}`}>
                    {errorBalance ? "⚠️ Error al obtener saldo" : `💳 Saldo disponible: ${balance} créditos`}
                </div>

                {/* Cargar Excel */}
                <div className="mb-4">
                    <label className="text-gray-300 block mb-2 text-sm font-medium">📂 Archivo Excel con teléfonos</label>
                    {!fileName ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-orange-500/30 rounded-xl p-5 cursor-pointer hover:border-orange-500/60 transition-all">
                            <Upload className="w-8 h-8 text-orange-400 mb-2" />
                            <span className="text-orange-300 text-sm">Haz clic para subir .xlsx</span>
                            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                        </label>
                    ) : (
                        <div className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3 border border-slate-600">
                            <div>
                                <p className="text-white text-sm font-medium">{fileName}</p>
                                <p className="text-green-400 text-xs mt-1">✅ {telefonos.length.toLocaleString()} teléfonos cargados</p>
                            </div>
                            <button onClick={handleEliminarArchivo} className="text-gray-400 hover:text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Mensaje */}
                <div className="mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-gray-300 text-sm font-medium">✍️ Mensaje SMS</label>
                        <span className={`text-xs ${caracteresRestantes < 0 ? "text-red-400" : "text-gray-400"}`}>
                            {mensaje.length}/160 caracteres
                        </span>
                    </div>
                    <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        className="w-full p-3 h-32 rounded-xl bg-slate-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                        placeholder="Escribe el mensaje que recibirán todos los contactos..."
                    />
                    {caracteresRestantes < 0 && (
                        <p className="text-red-400 text-xs mt-1">⚠️ El mensaje supera 160 caracteres — se enviará en {Math.ceil(mensaje.length / 160)} SMS</p>
                    )}
                </div>

                {/* Resumen */}
                {telefonos.length > 0 && mensaje.trim() && (
                    <div className="bg-slate-700/30 rounded-xl p-3 mb-4 border border-slate-600/50">
                        <p className="text-gray-300 text-sm">📊 <strong className="text-white">{telefonos.length.toLocaleString()}</strong> mensajes a enviar</p>
                        <p className="text-gray-300 text-sm mt-1">⏱️ Tiempo estimado: <strong className="text-white">~{Math.ceil(telefonos.length / 9 / 60)} minutos</strong></p>
                        <p className="text-gray-300 text-sm mt-1">💰 Créditos necesarios: <strong className="text-white">{telefonos.length.toLocaleString()}</strong></p>
                    </div>
                )}

                {/* Botón enviar */}
                <button
                    onClick={handleEnviar}
                    disabled={loading || telefonos.length === 0 || !mensaje.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando envío...</>
                    ) : (
                        <><MessageCircle className="w-5 h-5" /> Enviar {telefonos.length > 0 ? telefonos.length.toLocaleString() : ""} SMS</>
                    )}
                </button>

                {/* Respuesta */}
                {response && (
                    <div className={`p-4 mt-4 rounded-xl flex items-center gap-3 border ${response.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                        {response.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                        <span className="text-sm">{response.message}</span>
                    </div>
                )}

                {/* Progreso completado */}
                {progreso && (
                    <div className="p-4 mt-4 rounded-xl bg-slate-700/50 border border-slate-600">
                        <p className="text-white font-medium mb-2">🏁 Envío completado</p>
                        <p className="text-green-400 text-sm">✅ Enviados: {progreso.enviados}</p>
                        <p className="text-red-400 text-sm">❌ Fallidos: {progreso.fallidos}</p>
                        <p className="text-yellow-400 text-sm">🚫 Bloqueados: {progreso.bloqueados}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SendSMS;