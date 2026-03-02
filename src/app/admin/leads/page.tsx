'use client';

import { useState, useEffect } from 'react';
import { LeadStatus } from '@/lib/types';

export default function LeadsPage() {
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'email' } | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [showForceBotModal, setShowForceBotModal] = useState(false);
    const [forceBotPhone, setForceBotPhone] = useState('');
    const [isForcingBot, setIsForcingBot] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        agendados: 0,
        pendientes: 0,
        noAgendados: 0
    });

    useEffect(() => {
        fetchLeads();
    }, []);

    async function fetchLeads() {
        try {
            setLoading(true);
            const res = await fetch('/api/contacts');
            const data = await res.json();

            if (data.contacts) {
                setLeads(data.contacts);
                setStats({
                    total: data.contacts.length,
                    agendados: data.contacts.filter((l: any) => l.status === 'agendado').length,
                    pendientes: data.contacts.filter((l: any) => l.status === 'pendiente').length,
                    noAgendados: data.contacts.filter((l: any) => l.status === 'no_agendado').length
                });
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveCell(lead: any, field: 'name' | 'email', value: string) {
        setSavingId(lead._id || lead.id);
        try {
            const res = await fetch(`/api/contacts/${lead._id || lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            });
            if (res.ok) {
                setLeads(prev => prev.map(l =>
                    (l._id || l.id) === (lead._id || lead.id) ? { ...l, [field]: value } : l
                ));
            }
        } catch (e) {
            console.error('Error saving:', e);
        } finally {
            setSavingId(null);
            setEditingCell(null);
        }
    }

    async function handleForceBot(customPhone?: string) {
        const phoneToUse = customPhone || forceBotPhone;
        if (!phoneToUse) {
            alert('Ingresa un número de teléfono válido.');
            return;
        }
        if (!confirm(`¿Estás seguro de forzar el inicio del bot para el número ${phoneToUse}? Esto interrumpirá cualquier conversación activa.`)) return;

        setIsForcingBot(true);
        try {
            const res = await fetch('/api/bot/force-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneToUse })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Bot iniciado exitosamente para ' + phoneToUse);
                setShowForceBotModal(false);
                setForceBotPhone('');
                fetchLeads(); // refresh
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            console.error('Error forcing bot:', e);
            alert('Error de conexión');
        } finally {
            setIsForcingBot(false);
        }
    }

    function startEdit(lead: any, field: 'name' | 'email') {
        setEditingCell({ id: lead._id || lead.id, field });
        setEditingValue(lead[field] || '');
    }

    // Filter leads
    const filteredLeads = leads.filter(lead => {
        const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            lead.phone?.toLowerCase().includes(q) ||
            lead.name?.toLowerCase().includes(q) ||
            lead.email?.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const getStatusBadge = (status: LeadStatus) => {
        const badges = {
            agendado: 'badge-success',
            pendiente: 'badge-warning',
            no_agendado: 'badge-danger'
        };
        const labels = {
            agendado: 'Agendado',
            pendiente: 'Pendiente',
            no_agendado: 'No agendado'
        };
        return <span className={`badge ${badges[status]}`}>{labels[status]}</span>;
    };

    const getSourceBadge = (source: string) => {
        return source === 'meta_ads'
            ? <span className="badge badge-info">Meta Ads</span>
            : <span className="badge badge-neutral">Orgánico</span>;
    };

    const EditableCell = ({ lead, field }: { lead: any; field: 'name' | 'email' }) => {
        const cellId = lead._id || lead.id;
        const isEditing = editingCell?.id === cellId && editingCell?.field === field;
        const isSaving = savingId === cellId;
        const value = lead[field] || '';

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <input
                        autoFocus
                        type={field === 'email' ? 'email' : 'text'}
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveCell(lead, field, editingValue);
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                        className="input py-1 px-2 text-sm w-full min-w-0"
                        style={{ minWidth: '120px' }}
                    />
                    <button
                        onClick={() => handleSaveCell(lead, field, editingValue)}
                        disabled={isSaving}
                        className="text-green-600 hover:text-green-700 p-1 rounded"
                        title="Guardar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setEditingCell(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Cancelar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1 group cursor-pointer" onClick={() => startEdit(lead, field)}>
                <span className={value ? 'text-slate-800' : 'text-slate-400 italic text-sm'}>
                    {value || '—'}
                </span>
                <svg
                    className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Cargando leads...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
                    <p className="text-slate-500 mt-1">Gestión de contactos y potenciales clientes</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowForceBotModal(true)} className="btn bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                        ▶️ Forzar Bot a un Número
                    </button>
                    <button className="btn btn-primary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`card p-4 text-left transition-all ${statusFilter === 'all' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </button>
                <button
                    onClick={() => setStatusFilter('agendado')}
                    className={`card p-4 text-left transition-all ${statusFilter === 'agendado' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-green-600">Agendados</p>
                    <p className="text-2xl font-bold text-green-600">{stats.agendados}</p>
                </button>
                <button
                    onClick={() => setStatusFilter('pendiente')}
                    className={`card p-4 text-left transition-all ${statusFilter === 'pendiente' ? 'ring-2 ring-yellow-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-yellow-600">Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
                </button>
                <button
                    onClick={() => setStatusFilter('no_agendado')}
                    className={`card p-4 text-left transition-all ${statusFilter === 'no_agendado' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-red-600">No agendados</p>
                    <p className="text-2xl font-bold text-red-600">{stats.noAgendados}</p>
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar por teléfono, nombre o email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
                        className="input w-auto"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="agendado">Agendado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="no_agendado">No agendado</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Teléfono</th>
                            <th>
                                Nombre
                                <span className="text-slate-400 font-normal text-xs ml-1">(clic para editar)</span>
                            </th>
                            <th>
                                Email
                                <span className="text-slate-400 font-normal text-xs ml-1">(clic para editar)</span>
                            </th>
                            <th>Estado</th>
                            <th>Fuente</th>
                            <th>Tags</th>
                            <th>Último contacto</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeads.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-slate-500">
                                    No se encontraron leads
                                </td>
                            </tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr key={lead._id || lead.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <span className="font-medium">{lead.phone}</span>
                                        </div>
                                    </td>
                                    <td style={{ minWidth: '140px' }}>
                                        <EditableCell lead={lead} field="name" />
                                    </td>
                                    <td style={{ minWidth: '180px' }}>
                                        <EditableCell lead={lead} field="email" />
                                    </td>
                                    <td>{getStatusBadge(lead.status)}</td>
                                    <td>{getSourceBadge(lead.source)}</td>
                                    <td>
                                        <div className="flex flex-wrap gap-1">
                                            {lead.tags?.length === 0 ? (
                                                <span className="text-slate-400 text-sm">—</span>
                                            ) : (
                                                lead.tags?.map((tag: string, i: number) => (
                                                    <span key={i} className="badge badge-neutral">{tag}</span>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-slate-500">
                                        {new Date(lead.lastSeenAt).toLocaleString('es-AR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleForceBot(lead.phone)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Forzar inicio del bot"
                                                disabled={isForcingBot}
                                            >
                                                ▶️
                                            </button>
                                            <a
                                                href={`/admin/conversations/${encodeURIComponent(lead.phone)}`}
                                                className="btn btn-secondary py-2 px-3 text-sm"
                                            >
                                                Ver chat
                                            </a>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('¿Estás seguro de eliminar este lead? Se borrará todo su historial.')) return;
                                                    try {
                                                        const res = await fetch(`/api/contacts/${lead._id || lead.id}`, { method: 'DELETE' });
                                                        if (res.ok) {
                                                            setLeads(prev => prev.filter(l => (l._id || l.id) !== (lead._id || lead.id)));
                                                            setStats(prev => ({
                                                                ...prev,
                                                                total: prev.total - 1,
                                                                [lead.status === 'agendado' ? 'agendados' : lead.status === 'pendiente' ? 'pendientes' : 'noAgendados']: (prev as any)[lead.status === 'agendado' ? 'agendados' : lead.status === 'pendiente' ? 'pendientes' : 'noAgendados'] - 1
                                                            }));
                                                        }
                                                    } catch (e) {
                                                        console.error('Error deleting lead:', e);
                                                        alert('Error al eliminar lead');
                                                    }
                                                }}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar lead"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

            {/* Force Bot Modal */}
            {showForceBotModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-springUp">
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 text-lg">Forzar Inicio del Bot</h3>
                            <button onClick={() => setShowForceBotModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-slate-600">
                                Introducí el número de teléfono con código de país (ej: 5491123456789).
                                Al iniciarlo, el usuario recibirá inmediatamente el menú principal y cualquier conversación anterior será cerrada.
                            </p>
                            <div>
                                <label className="label">Teléfono</label>
                                <input
                                    type="text"
                                    value={forceBotPhone}
                                    onChange={(e) => setForceBotPhone(e.target.value)}
                                    placeholder="549..."
                                    className="input w-full"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-[var(--border)] flex justify-end gap-2">
                            <button onClick={() => setShowForceBotModal(false)} className="btn btn-secondary">Cancelar</button>
                            <button
                                onClick={() => handleForceBot()}
                                disabled={isForcingBot || !forceBotPhone.trim()}
                                className="btn btn-primary"
                            >
                                {isForcingBot ? 'Iniciando...' : 'Iniciar Bot'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
