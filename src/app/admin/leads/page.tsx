'use client';

import { useState, useEffect } from 'react';
import { LeadStatus } from '@/lib/types';

export default function LeadsPage() {
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all' | 'paused'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'email' } | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [showForceBotModal, setShowForceBotModal] = useState(false);
    const [forceBotPhone, setForceBotPhone] = useState('');
    const [isForcingBot, setIsForcingBot] = useState(false);
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [showLegend, setShowLegend] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        agendados: 0,
        pendientes: 0,
        noAgendados: 0
    });

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchLeads();
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    async function fetchLeads() {
        try {
            setLoading(true);
            const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
            const res = await fetch(`/api/contacts${queryParam}`);
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

    async function handlePauseBot(phone: string) {
        if (!confirm(`¿Pausar el bot para el número ${phone}?`)) return;
        try {
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: 'paused' })
            });
            if (res.ok) {
                alert('Bot pausado exitosamente.');
            } else {
                alert('No se pudo pausar. Puede que no tenga conversación activa.');
            }
        } catch (e) {
            console.error('Error pausing bot:', e);
            alert('Error de conexión');
        }
    }

    async function handleRetryStep(phone: string) {
        if (!confirm(`¿Destrabar el bot para ${phone}? Se reenviará el mensaje del paso en el que se trabó.`)) return;

        try {
            const res = await fetch('/api/bot/retry-step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Bot destrabado exitosamente.');
                fetchLeads(); // refresh
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            console.error('Error in retry-step:', e);
            alert('Error de conexión');
        }
    }

    function startEdit(lead: any, field: 'name' | 'email') {
        setEditingCell({ id: lead._id || lead.id, field });
        setEditingValue(lead[field] || '');
    }

    // Normalize phone/search string for flexible matching
    const normalizePhone = (s: string) => (s || '').replace(/[\s\-\+]/g, '').replace(/^549/, '');

    // Filter leads
    const filteredLeads = leads.filter(lead => {
        // 'paused' is a special filter that checks conversationState, not lead status
        let matchesStatus = true;
        if (statusFilter === 'paused') {
            matchesStatus = lead.conversationState === 'paused';
        } else if (statusFilter !== 'all') {
            matchesStatus = lead.status === statusFilter;
        }
        const q = normalizePhone(searchQuery).toLowerCase();
        const qRaw = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            normalizePhone(lead.phone).includes(q) ||
            (lead.name || '').toLowerCase().includes(qRaw) ||
            (lead.pushname || '').toLowerCase().includes(qRaw) ||
            (lead.email || '').toLowerCase().includes(qRaw);
        const allTags = [...(lead.tags || []), ...(lead.conversationTags || [])];
        const matchesTag = tagFilter === 'all' || allTags.includes(tagFilter);
        return matchesStatus && matchesSearch && matchesTag;
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
        <div className="animate-fadeIn w-full max-w-full">
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                    className={`card p-4 text-left transition-all bg-white border ${statusFilter === 'no_agendado' ? 'ring-2 ring-red-500 border-red-200' : 'border-slate-100 hover:shadow-md'}`}
                >
                    <p className="text-sm text-red-600">No agendados</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.noAgendados}</p>
                </button>
                <button
                    onClick={() => setStatusFilter('paused')}
                    className={`card p-4 text-left transition-all bg-white border ${statusFilter === 'paused' ? 'ring-2 ring-orange-500 border-orange-200' : 'border-slate-100 hover:shadow-md'}`}
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-orange-600">Pausados</p>
                    </div>
                    <p className="text-sm text-orange-600 mb-1">(Derivados)</p>
                    <p className="text-2xl font-bold text-orange-600">{leads.filter(l => l.conversationState === 'paused').length}</p>
                </button>
            </div>

            {/* Search bar — prominent, standalone */}
            <div className="mb-4">
                <div className="relative">
                    <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar por teléfono, nombre o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 text-base rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Tag Legend */}
            <div className="mb-4">
                <button
                    onClick={() => setShowLegend(v => !v)}
                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                >
                    <svg className={`w-3.5 h-3.5 transition-transform ${showLegend ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    🏷️ Ver leyenda de etiquetas automáticas
                </button>
                {showLegend && (
                    <div className="mt-2 card p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { tag: 'atencion-requerida', color: 'bg-orange-500', label: 'Atención requerida', desc: 'Requiere revisión humana' },
                            { tag: 'solicito-info', color: 'bg-indigo-500', label: 'Solicitó info', desc: 'Recibió links de tienda o PDFs' },
                            { tag: 'otros-temas', color: 'bg-purple-500', label: 'Otros temas', desc: 'Dejó una consulta libre' },
                            { tag: 'pago-enviado', color: 'bg-blue-500', label: 'Pago enviado', desc: 'Envió comprobante de pago' },
                            { tag: 'intento-pagar', color: 'bg-emerald-500', label: 'Intentó pagar', desc: 'Llegó al paso de pago / pidió link' },
                            { tag: 'mensaje-de-voz', color: 'bg-yellow-400', label: 'Mensaje de voz', desc: 'Mandó un audio' },
                            { tag: 'intervencion-humana', color: 'bg-red-500', label: 'Intervención humana', desc: 'Pidió hablar con asesor' },
                            { tag: 'fallback-lockout', color: 'bg-slate-400', label: 'Bloqueado', desc: 'Demasiados intentos fallidos' },
                        ].map(({ tag, color, label, desc }) => (
                            <div key={tag} className="flex items-start gap-2">
                                <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}></span>
                                <div>
                                    <p className="text-xs font-semibold text-slate-700">{label}</p>
                                    <p className="text-xs text-slate-400">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
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
                        {(searchQuery || tagFilter !== 'all') && (
                            <span className="text-sm text-blue-600 font-medium">
                                {filteredLeads.length} resultado{filteredLeads.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {/* Tag filter pills */}
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-slate-400 self-center mr-1">Filtrar por etiqueta:</span>
                        {[
                            { tag: 'all', label: 'Todas', cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
                            { tag: 'atencion-requerida', label: '🟠 Atención', cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
                            { tag: 'solicito-info', label: 'ℹ️ Solicitó info', cls: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
                            { tag: 'pago-enviado', label: '🟦 Pago enviado', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                            { tag: 'intento-pagar', label: '🟢 Quiso pagar', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                            { tag: 'otros-temas', label: '🟣 Otros temas', cls: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
                            { tag: 'mensaje-de-voz', label: '🟡 Audio', cls: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
                            { tag: 'intervencion-humana', label: '🔴 Asesor', cls: 'bg-red-100 text-red-700 hover:bg-red-200' },
                        ].map(({ tag, label, cls }) => (
                            <button
                                key={tag}
                                onClick={() => setTagFilter(tag)}
                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${cls} ${tagFilter === tag ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0] z-20">Teléfono</th>
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
                                <th className="sticky right-0 bg-slate-50 shadow-[-1px_0_0_0_#e2e8f0] z-20">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16">
                                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            {searchQuery ? (
                                                <div className="text-center">
                                                    <p className="font-medium text-slate-500">Sin resultados para <span className="font-bold text-slate-700">"{searchQuery}"</span></p>
                                                    <p className="text-sm mt-1">Probá con otro formato: con o sin +54, con o sin guion</p>
                                                </div>
                                            ) : tagFilter !== 'all' ? (
                                                <p className="font-medium text-slate-500">No hay leads con la etiqueta <span className="font-bold text-slate-700">{tagFilter}</span></p>
                                            ) : (
                                                <p className="font-medium text-slate-500">No se encontraron leads</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead._id || lead.id} className="group">
                                        <td className="sticky left-0 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0] z-10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    <span
                                                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${lead.conversationState === 'active' ? 'bg-green-500' :
                                                            lead.conversationState === 'paused' ? 'bg-yellow-400' :
                                                                'bg-slate-300'
                                                            }`}
                                                        title={lead.conversationState === 'active' ? 'Bot activo' : lead.conversationState === 'paused' ? 'Pausado' : 'Sin conversación'}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-medium block">{lead.phone}</span>
                                                    {!lead.name && lead.pushname && (
                                                        <span className="text-xs text-slate-400 block truncate">{lead.pushname}</span>
                                                    )}
                                                </div>
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
                                                {!lead.tags || lead.tags.length === 0 ? (
                                                    <span className="text-slate-400 text-sm">—</span>
                                                ) : (
                                                    lead.tags.map((tag: string, i: number) => (
                                                        <span key={i} className={`badge text-[10px] py-0.5 px-1.5 ${tag === 'atencion-requerida' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                            tag === 'otros-temas' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                                tag === 'pago-enviado' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                                tag === 'intento-pagar' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                                                tag === 'solicito-info' ? 'bg-teal-100 text-teal-700 border border-teal-200' :
                                                                tag === 'datos-completos' ? 'bg-green-100 text-green-700 border border-green-200 font-medium' :
                                                                    'badge-neutral'
                                                            }`}>{tag}</span>
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
                                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-1px_0_0_0_#e2e8f0] z-10 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePauseBot(lead.phone)}
                                                    className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                                    title="Pausar el bot"
                                                >
                                                    ⏸️
                                                </button>
                                                <button
                                                    onClick={() => handleForceBot(lead.phone)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Forzar inicio del bot"
                                                    disabled={isForcingBot}
                                                >
                                                    ▶️
                                                </button>
                                                <button
                                                    onClick={() => handleRetryStep(lead.phone)}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    title="Destrabar / reintentar paso actual"
                                                >
                                                    🔄
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
