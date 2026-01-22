'use client';

import { useState, useEffect } from 'react';

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const res = await fetch('/api/appointments');
            const data = await res.json();
            setAppointments(data.appointments || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            const res = await fetch('/api/appointments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            if (res.ok) {
                setAppointments(prev => prev.map(a => a._id === id ? { ...a, status } : a));
            }
        } catch (error) {
            console.error('Error updating appointment:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            pending: 'badge-warning',
            confirmed: 'badge-success',
            cancelled: 'badge-danger'
        };
        const labels: Record<string, string> = {
            pending: '⏳ Pendiente',
            confirmed: '✅ Confirmado',
            cancelled: '❌ Cancelado'
        };
        return <span className={`badge ${badges[status] || 'badge-neutral'}`}>{labels[status] || status}</span>;
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando turnos...</div>;

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-outfit">Gestión de Turnos</h1>
                    <p className="text-slate-500 mt-1">Pedidos de turnos capturados automáticamente por el bot.</p>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table min-w-[900px]">
                        <thead>
                            <tr>
                                <th>Paciente / DNI</th>
                                <th>Teléfono</th>
                                <th>Día</th>
                                <th>Horario</th>
                                <th>Estado</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                                        No hay turnos registrados aún.
                                    </td>
                                </tr>
                            ) : (
                                appointments.map((appt) => (
                                    <tr key={appt._id}>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{appt.patientName || 'Sin nombre'}</span>
                                                <span className="text-xs text-slate-500">DNI: {appt.patientDni || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <a href={`https://wa.me/${appt.phone.replace(/\+/g, '')}`} target="_blank" className="text-blue-600 hover:underline font-medium">
                                                {appt.phone}
                                            </a>
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800">{appt.dayName}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(appt.date).toLocaleDateString('es-AR')}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm">
                                                {appt.timeSlot}
                                            </span>
                                        </td>
                                        <td>{getStatusBadge(appt.status)}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {appt.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => updateStatus(appt._id, 'confirmed')}
                                                            className="btn btn-secondary py-1 px-2 text-xs text-green-600 border-green-100 hover:bg-green-50"
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => updateStatus(appt._id, 'cancelled')}
                                                            className="btn btn-secondary py-1 px-2 text-xs text-red-600 border-red-100 hover:bg-red-50"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    className="p-2 text-slate-400 hover:text-blue-600"
                                                    onClick={() => window.open(`/admin/conversations/${encodeURIComponent(appt.phone)}`, '_blank')}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
