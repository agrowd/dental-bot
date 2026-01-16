'use client';

import { useState, useEffect } from 'react';

type BotStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface BotInfo {
    phone?: string;
    name?: string;
}

export default function WhatsAppPage() {
    const [status, setStatus] = useState<BotStatus>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [botInfo, setBotInfo] = useState<BotInfo>({});
    const [countdown, setCountdown] = useState(45);
    const [loading, setLoading] = useState(false);

    // Poll bot status
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('http://localhost:4000/bot/status');
                const data = await res.json();
                setStatus(data.status);

                // If connecting, try to get QR
                if (data.status === 'connecting') {
                    const qrRes = await fetch('http://localhost:4000/bot/qr');
                    if (qrRes.ok) {
                        const qrData = await qrRes.json();
                        setQrCode(qrData.qr);
                    }
                } else {
                    setQrCode(null);
                }

                // If connected, get bot info
                if (data.status === 'connected') {
                    const infoRes = await fetch('http://localhost:4000/bot/info');
                    if (infoRes.ok) {
                        const infoData = await infoRes.json();
                        setBotInfo(infoData);
                    }
                }
            } catch (error) {
                console.error('Error checking bot status:', error);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, []);

    // QR countdown
    useEffect(() => {
        if (status === 'connecting' && qrCode) {
            setCountdown(45);
            const timer = setInterval(() => {
                setCountdown(prev => Math.max(0, prev - 1));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [status, qrCode]);

    const handleActivate = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:4000/bot/start', { method: 'POST' });
            if (!res.ok) {
                const error = await res.json();
                alert(error.error || 'Error activating bot');
            }
        } catch (error) {
            alert('Error connecting to bot');
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Seguro que querés desconectar el bot?')) return;

        setLoading(true);
        try {
            await fetch('http://localhost:4000/bot/logout', { method: 'POST' });
        } catch (error) {
            alert('Error disconnecting bot');
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        disconnected: { color: 'text-slate-500', bg: 'bg-slate-100', emoji: '⚫', label: 'Desconectado' },
        connecting: { color: 'text-yellow-600', bg: 'bg-yellow-100', emoji: '🟡', label: 'Conectando...' },
        connected: { color: 'text-green-600', bg: 'bg-green-100', emoji: '🟢', label: 'Conectado' },
        error: { color: 'text-red-600', bg: 'bg-red-100', emoji: '🔴', label: 'Error' },
    };

    const currentStatus = statusConfig[status];

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
                <p className="text-slate-500 mt-1">Control de conexión del bot</p>
            </div>

            <div className="max-w-2xl">
                {/* Status Card */}
                <div className="card p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-slate-900">🤖 Estado del Bot</h2>
                        <span className={`${currentStatus.bg} ${currentStatus.color} px-3 py-1 rounded-full text-sm font-medium`}>
                            {currentStatus.emoji} {currentStatus.label}
                        </span>
                    </div>

                    {/* Disconnected State */}
                    {status === 'disconnected' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <p className="text-slate-600 mb-6">El bot está apagado.</p>
                            <button onClick={handleActivate} disabled={loading} className="btn btn-primary">
                                {loading ? 'Activando...' : '🚀 Activar Bot'}
                            </button>
                        </div>
                    )}

                    {/* Connecting State - Show QR */}
                    {status === 'connecting' && (
                        <div className="text-center py-8">
                            {qrCode ? (
                                <>
                                    <div className="bg-white p-4 rounded-xl inline-block mb-4 border-2 border-yellow-200">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`} alt="QR Code" className="w-64 h-64" />
                                    </div>
                                    <p className="text-slate-700 font-medium mb-2">Escaneá el código con WhatsApp</p>
                                    <p className="text-yellow-600 font-mono">{countdown}s restantes</p>
                                    <button onClick={handleDisconnect} className="btn btn-secondary mt-4">
                                        ❌ Cancelar
                                    </button>
                                </>
                            ) : (
                                <p className="text-yellow-600">Generando código QR...</p>
                            )}
                        </div>
                    )}

                    {/* Connected State */}
                    {status === 'connected' && (
                        <div className="py-4">
                            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-green-900">Bot Activo</p>
                                    <p className="text-sm text-green-700">📱 {botInfo.phone || 'Cargando...'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-xs text-slate-500 mb-1">Nombre</p>
                                    <p className="font-medium text-slate-900">{botInfo.name || 'Bot Clínica'}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-xs text-slate-500 mb-1">Estado</p>
                                    <p className="font-medium text-green-600">✓ Listo para recibir mensajes</p>
                                </div>
                            </div>

                            <button onClick={handleDisconnect} disabled={loading} className="btn btn-danger w-full">
                                {loading ? 'Desconectando...' : '🔌 Desconectar Bot'}
                            </button>
                        </div>
                    )}

                    {/* Error State */}
                    {status === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-red-600 mb-6">Error de conexión. Intentá nuevamente.</p>
                            <button onClick={handleActivate} disabled={loading} className="btn btn-primary">
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="card p-6 mt-6 bg-blue-50 border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 Instrucciones</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Presioná "Activar Bot" para generar el QR</li>
                        <li>• Abrí WhatsApp → Dispositivos vinculados → Escanear QR</li>
                        <li>• El bot quedará conectado hasta que lo desconectes</li>
                        <li>• Podés desconectar y reconectar cuando quieras</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
