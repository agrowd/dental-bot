'use client';

import Link from 'next/link';
import { mockFlows } from '@/lib/mock-data';

export default function FlowsPage() {
    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Flow Builder</h1>
                    <p className="text-slate-500 mt-1">Configurá flujos según origen y si el contacto está agendado en WhatsApp</p>
                </div>
                <button className="btn btn-primary">
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
                {mockFlows.map((flow) => (
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
                                {Object.keys(flow.draft.steps).length} pasos
                            </div>
                            <span className="text-sm text-blue-600 font-medium group-hover:underline">
                                Editar flujo →
                            </span>
                        </div>
                    </Link>
                ))}

                {/* Create new flow card */}
                <button className="card p-6 border-2 border-dashed hover:border-blue-300 hover:bg-blue-50/50 transition-all group flex flex-col items-center justify-center min-h-[240px]">
                    <div className="p-4 bg-slate-100 rounded-full text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <p className="font-medium text-slate-600 group-hover:text-blue-600">Crear nuevo flujo</p>
                    <p className="text-sm text-slate-400 mt-1">Configurar reglas de activación</p>
                </button>
            </div>
        </div>
    );
}
