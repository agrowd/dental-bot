'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function FlowsPage() {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchFlows();
    }, []);

    async function fetchFlows() {
        try {
            const res = await fetch('/api/flows');
            const data = await res.json();
            setFlows(data.flows || []);
        } catch (error) {
            console.error('Error fetching flows:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFlow() {
        if (!newFlowName.trim()) {
            alert('Por favor ingresa un nombre para el flujo');
            return;
        }

        setCreating(true);
        try {
            const res = await fetch('/api/flows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newFlowName,
                    description: '',
                    activationRules: {
                        sources: { meta_ads: false, organic: true },
                        whatsappStatus: { agendado: false, no_agendado: true },
                        priority: 10
                    },
                    draft: {
                        entryStepId: 'welcome',
                        steps: {
                            welcome: {
                                id: 'welcome',
                                title: 'Bienvenida',
                                message: 'Hola! ¿En qué puedo ayudarte?',
                                options: []
                            }
                        }
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                setShowCreateModal(false);
                setNewFlowName('');
                // Redirect to edit page
                window.location.href = `/admin/flows/${data.flow.id}`;
            } else {
                const error = await res.json();
                alert(error.error || 'Error creating flow');
            }
        } catch (error) {
            alert('Error creating flow');
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Cargando flujos...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Flow Builder</h1>
                    <p className="text-slate-500 mt-1">Configurá flujos según origen y si el contacto está agendado en WhatsApp</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear nuevo flujo
                </button>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-blue-900">¿Cómo funciona?</h3>
                        <p className="text-blue-800 mt-1">
                            El bot detecta automáticamente si el número que escribe está <strong>guardado en la agenda del teléfono</strong> (agendado) o no (no agendado),
                            y también de dónde viene (Meta Ads u orgánico). Según estas reglas, envía el flujo correspondiente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Flows Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {flows.map((flow) => (
                    <Link
                        key={flow.id}
                        href={`/admin/flows/${flow.id}`}
                        className="card p-6 hover:shadow-lg transition-all hover:border-blue-200 group"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-slate-900">{flow.name}</h3>
                                    {flow.isActive ? (
                                        <span className="w-2 h-2 bg-green-500 rounded-full" title="Activo"></span>
                                    ) : (
                                        <span className="w-2 h-2 bg-slate-300 rounded-full" title="Inactivo"></span>
                                    )}
                                </div>
                                {flow.description && (
                                    <p className="text-sm text-slate-500">{flow.description}</p>
                                )}
                            </div>
                            <span className="badge badge-info">P: {flow.activationRules.priority}</span>
                        </div>

                        {/* Activation Rules */}
                        <div className="space-y-3 mb-4">
                            {/* Sources */}
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Origen</p>
                                <div className="flex flex-wrap gap-2">
                                    {flow.activationRules.sources.meta_ads && (
                                        <span className="badge badge-info">📢 Meta Ads</span>
                                    )}
                                    {flow.activationRules.sources.organic && (
                                        <span className="badge badge-neutral">💬 Orgánico</span>
                                    )}
                                </div>
                            </div>

                            {/* WhatsApp Status */}
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Estado en WhatsApp</p>
                                <div className="flex flex-wrap gap-2">
                                    {flow.activationRules.whatsappStatus.agendado && (
                                        <span className="badge badge-success">📇 Agendado</span>
                                    )}
                                    {flow.activationRules.whatsappStatus.no_agendado && (
                                        <span className="badge badge-warning">❓ No agendado</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                {Object.keys(flow.draft?.steps || {}).length} pasos
                            </div>
                            <span className="text-sm text-blue-600 font-medium group-hover:underline">
                                Editar flujo →
                            </span>
                        </div>
                    </Link>
                ))}

                {/* Create new flow card */}
                <button
                    className="card p-6 border-2 border-dashed hover:border-blue-300 hover:bg-blue-50/50 transition-all group flex flex-col items-center justify-center min-h-[240px]"
                    onClick={() => setShowCreateModal(true)}
                >
                    <div className="p-4 bg-slate-100 rounded-full text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <p className="font-medium text-slate-600 group-hover:text-blue-600">Crear nuevo flujo</p>
                    <p className="text-sm text-slate-400 mt-1">Configurar reglas de activación</p>
                </button>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="card p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Crear nuevo flujo</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nombre del flujo
                            </label>
                            <input
                                type="text"
                                className="input w-full"
                                placeholder="Ej: Flujo para clientes nuevos"
                                value={newFlowName}
                                onChange={(e) => setNewFlowName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateFlow()}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                                disabled={creating}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateFlow}
                                disabled={creating || !newFlowName.trim()}
                            >
                                {creating ? 'Creando...' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
