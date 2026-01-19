'use client';

import { useState, useEffect } from 'react';
import { LeadStatus } from '@/lib/types';

export default function LeadsPage() {
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        agendados: 0,
        pendientes: 0,
        noAgendados: 0
    });

    useEffect(() => {
        async function fetchLeads() {
            try {
                setLoading(true);
                const res = await fetch('/api/contacts');
                const data = await res.json();

                if (data.contacts) {
                    setLeads(data.contacts);

                    // Calculate stats
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

        fetchLeads();
    }, []);

    // Filter leads
    const filteredLeads = leads.filter(lead => {
        const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
        const matchesSearch = lead.phone.includes(searchQuery);
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
                <button className="btn btn-primary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Exportar CSV
                </button>
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
                                placeholder="Buscar por teléfono..."
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
                                <td colSpan={6} className="text-center py-12 text-slate-500">
                                    No se encontraron leads
                                </td>
                            </tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr key={lead._id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <span className="font-medium">{lead.phone}</span>
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(lead.status)}</td>
                                    <td>{getSourceBadge(lead.source)}</td>
                                    <td>
                                        <div className="flex flex-wrap gap-1">
                                            {lead.tags.length === 0 ? (
                                                <span className="text-slate-400 text-sm">—</span>
                                            ) : (
                                                lead.tags.map((tag: string, i: number) => (
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
                                            <a
                                                href={`/admin/conversations/${encodeURIComponent(lead.phone)}`}
                                                className="btn btn-secondary py-2 px-3 text-sm"
                                            >
                                                Ver chat
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
