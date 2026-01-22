'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConversationState } from '@/lib/types';

export default function ConversationsPage() {
    const [stateFilter, setStateFilter] = useState<ConversationState | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConversations();
    }, []);

    async function fetchConversations() {
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }

    // Filter conversations
    const filteredConversations = conversations.filter(conv => {
        const matchesState = stateFilter === 'all' || conv.state === stateFilter;
        const matchesSearch = conv.phone.includes(searchQuery);
        return matchesState && matchesSearch;
    });

    async function handleDelete(phone: string) {
        if (!confirm(`¿Estás seguro de eliminar la conversación de ${phone} y todo su historial?`)) return;

        try {
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setConversations(prev => prev.filter(c => c.phone !== phone));
            } else {
                alert('Error al eliminar la conversación');
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            alert('Error al conectar con el servidor');
        }
    }

    const getStateBadge = (state: ConversationState) => {
        const badges: Record<ConversationState, string> = {
            active: 'bg-green-600 text-white shadow-sm ring-1 ring-green-900/10',
            paused: 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-900/10',
            closed: 'bg-slate-400 text-white shadow-sm'
        };
        const labels: Record<ConversationState, string> = {
            active: '🟢 BOT (Activo)',
            paused: '👤 Derivado con Personal',
            closed: 'Cerrado'
        };
        return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badges[state]} whitespace-nowrap`}>{labels[state]}</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn max-w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Conversaciones</h1>
                    <p className="text-slate-500 mt-1">Historial de chats con el bot</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => setStateFilter('all')}
                    className={`card p-4 text-left transition-all ${stateFilter === 'all' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{conversations.length}</p>
                </button>
                <button
                    onClick={() => setStateFilter('active')}
                    className={`card p-4 text-left transition-all ${stateFilter === 'active' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-green-600">Activas</p>
                    <p className="text-2xl font-bold text-green-600">{conversations.filter(c => c.state === 'active').length}</p>
                </button>
                <button
                    onClick={() => setStateFilter('paused')}
                    className={`card p-4 text-left transition-all ${stateFilter === 'paused' ? 'ring-2 ring-yellow-500' : 'hover:shadow-md'}`}
                >
                    <p className="text-sm text-yellow-600">Pausadas (Handoff)</p>
                    <p className="text-2xl font-bold text-yellow-600">{conversations.filter(c => c.state === 'paused').length}</p>
                </button>
            </div>

            {/* Search */}
            <div className="card mb-6">
                <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
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
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value as ConversationState | 'all')}
                        className="input sm:w-auto"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activas</option>
                        <option value="paused">Pausadas</option>
                        <option value="closed">Cerradas</option>
                    </select>
                </div>
            </div>

            {/* Table wrapper for horizontal scroll */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table min-w-[800px]">
                        <thead>
                            <tr>
                                <th>Teléfono</th>
                                <th>Estado</th>
                                <th>Paso Actual</th>
                                <th className="max-w-[200px]">Tags</th>
                                <th>Última actividad</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConversations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-500">
                                        No se encontraron conversaciones
                                    </td>
                                </tr>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <tr key={conv.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                </div>
                                                <span className="font-medium whitespace-nowrap">{conv.phone}</span>
                                            </div>
                                        </td>
                                        <td>{getStateBadge(conv.state)}</td>
                                        <td>
                                            <span className="badge badge-info truncate max-w-[120px]" title={conv.currentStepId}>
                                                {conv.currentStepId}
                                            </span>
                                        </td>
                                        <td className="max-w-[200px]">
                                            <div className="flex flex-wrap gap-1 max-h-[48px] overflow-hidden">
                                                {conv.tags.length === 0 ? (
                                                    <span className="text-slate-400 text-sm">—</span>
                                                ) : (
                                                    conv.tags.map((tag: string, i: number) => (
                                                        <span key={i} className="badge badge-neutral text-[10px] py-0.5 px-1.5">{tag}</span>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-slate-500 whitespace-nowrap">
                                            {new Date(conv.updatedAt).toLocaleString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/conversations/${encodeURIComponent(conv.phone)}`}
                                                    className="btn btn-secondary py-1.5 px-3 text-xs"
                                                >
                                                    Detalles
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(conv.phone)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar conversación"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
    );
}
