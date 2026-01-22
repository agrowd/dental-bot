'use client';

import { useState, useEffect } from 'react';

const DAYS = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const DEFAULT_SCHEDULE = DAYS.reduce((acc, day) => ({
    ...acc,
    [day.key]: { open: '09:00', close: '20:00', active: day.key !== 'sunday' }
}), {});

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [schedule, setSchedule] = useState<any>(DEFAULT_SCHEDULE);
    const [closedMessage, setClosedMessage] = useState('¡Hola! 👋 Gracias por escribirnos. En este momento la clínica está cerrada. Nuestro horario de atención es de Lunes a Viernes de 9 a 20hs y Sábados de 9 a 13hs. Te contactaremos apenas estemos de regreso.');
    const [paymentEnabled, setPaymentEnabled] = useState(false);
    const [paymentLink, setPaymentLink] = useState('');
    const [paymentMessage, setPaymentMessage] = useState('💳 Para confirmar tu turno, por favor realizá el pago de la consulta en el siguiente link:\n{LINK}');
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // Fetch Business Hours
            const bhRes = await fetch('/api/settings?key=business_hours');
            const bhData = await bhRes.json();
            if (bhData.setting) {
                setEnabled(bhData.setting.enabled);
                setSchedule(bhData.setting.schedule || DEFAULT_SCHEDULE);
                setClosedMessage(bhData.setting.closedMessage);
            }

            // Fetch Payment Config
            const pRes = await fetch('/api/settings?key=payment_config');
            const pData = await pRes.json();
            if (pData.setting) {
                setPaymentEnabled(pData.setting.enabled);
                setPaymentLink(pData.setting.link || '');
                setPaymentMessage(pData.setting.message || paymentMessage);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save Business Hours
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'business_hours',
                    value: { enabled, schedule, closedMessage }
                })
            });

            // Save Payment Config
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'payment_config',
                    value: { enabled: paymentEnabled, link: paymentLink, message: paymentMessage }
                })
            });

            if (res.ok) {
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const updateSchedule = (day: string, field: string, value: any) => {
        setSchedule((prev: any) => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    if (loading) return <div className="p-8 text-center">Cargando configuración...</div>;

    return (
        <div className="max-w-4xl mx-auto animate-fadeIn group">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-outfit">Configuración General</h1>
                    <p className="text-slate-500 mt-1">Personaliza el comportamiento del bot y los horarios de la clínica.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary shadow-lg shadow-blue-500/20"
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>

            <div className="space-y-6">
                {/* Business Hours Toggle */}
                <div className="card overflow-hidden border-none shadow-sm bg-white">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${enabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'} transition-colors`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-800">Horarios de Atención</h2>
                                <p className="text-xs text-slate-500">Activa la respuesta automática fuera de hora.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className={`p-6 space-y-4 transition-all duration-300 ${!enabled ? 'opacity-40 grayscale pointer-events-none blur-[1px]' : ''}`}>
                        <div className="grid grid-cols-1 gap-4">
                            {DAYS.map((day) => (
                                <div key={day.key} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group/day">
                                    <div className="w-24">
                                        <span className="text-sm font-medium text-slate-700">{day.label}</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={schedule[day.key]?.active}
                                            onChange={(e) => updateSchedule(day.key, 'active', e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
                                    </label>
                                    <div className={`flex items-center gap-2 transition-opacity ${!schedule[day.key]?.active ? 'opacity-30' : ''}`}>
                                        <input
                                            type="time"
                                            value={schedule[day.key]?.open}
                                            disabled={!schedule[day.key]?.active}
                                            onChange={(e) => updateSchedule(day.key, 'open', e.target.value)}
                                            className="input py-1 px-2 w-32 text-center"
                                        />
                                        <span className="text-slate-400 text-sm">a</span>
                                        <input
                                            type="time"
                                            value={schedule[day.key]?.close}
                                            disabled={!schedule[day.key]?.active}
                                            onChange={(e) => updateSchedule(day.key, 'close', e.target.value)}
                                            className="input py-1 px-2 w-32 text-center"
                                        />
                                    </div>
                                    {!schedule[day.key]?.active && (
                                        <span className="text-xs text-slate-400 font-medium ml-auto px-3 py-1 bg-slate-100 rounded-full">Cerrado</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Payment Configuration */}
                <div className="card border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${paymentEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'} transition-colors`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-800">Link de Pago</h2>
                                <p className="text-xs text-slate-500">Enviar link de pago automáticamente al agendar un turno.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={paymentEnabled}
                                onChange={(e) => setPaymentEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    <div className={`p-6 space-y-4 transition-all duration-300 ${!paymentEnabled ? 'opacity-40 grayscale pointer-events-none blur-[1px]' : ''}`}>
                        <div>
                            <label className="label">Link de Mercado Pago / Pago</label>
                            <input
                                type="text"
                                value={paymentLink}
                                onChange={(e) => setPaymentLink(e.target.value)}
                                className="input"
                                placeholder="https://mpago.la/..."
                            />
                        </div>
                        <div>
                            <label className="label">Mensaje de Pago</label>
                            <textarea
                                value={paymentMessage}
                                onChange={(e) => setPaymentMessage(e.target.value)}
                                className="input min-h-[100px]"
                                placeholder="Escribe el mensaje que acompaña al link..."
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Usa <span className="font-mono">{'{LINK}'}</span> donde quieras que aparezca el enlace.</p>
                        </div>
                    </div>
                </div>

                {/* Closed Message */}
                <div className="card border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-slate-50/30">
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800">Mensaje Fuera de Horario</h2>
                            <p className="text-xs text-slate-500">¿Qué le dirá el bot a los pacientes cuando la clínica esté cerrada?</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <textarea
                            value={closedMessage}
                            onChange={(e) => setClosedMessage(e.target.value)}
                            className="input min-h-[120px] text-sm leading-relaxed"
                            placeholder="Escribe el mensaje de ausencia aquí..."
                        />
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Consejo: Sé amable y aclara cuándo estarás disponible de nuevo.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Toast */}
            {showToast && (
                <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideIn z-[100] border border-white/10">
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="font-medium">Configuración guardada exitosamente</span>
                </div>
            )}
        </div>
    );
}
