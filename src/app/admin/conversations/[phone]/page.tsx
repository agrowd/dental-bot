'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { mockConversations, getMessagesForPhone, mockFlow } from '@/lib/mock-data';

export default function ConversationDetailPage() {
    const params = useParams();
    const phone = decodeURIComponent(params.phone as string);

    const conversation = mockConversations.find(c => c.phone === phone);
    const messages = getMessagesForPhone(phone);
    const [isPaused, setIsPaused] = useState(conversation?.state === 'paused');

    if (!conversation) {
        return (
            <div className="animate-fadeIn">
                <div className="card p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Conversación no encontrada</h2>
                    <p className="text-slate-500 mb-4">No existe una conversación con el número {phone}</p>
                    <Link href="/admin/conversations" className="btn btn-primary">
                        Volver a conversaciones
                    </Link>
                </div>
            </div>
        );
    }

    const currentStep = mockFlow.draft.steps[conversation.currentStepId];

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/conversations" className="p-2 hover:bg-slate-100 rounded-lg">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">{phone}</h1>
                    <p className="text-slate-500">Conversación iniciada el {new Date(conversation.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {isPaused ? (
                        <button
                            onClick={() => setIsPaused(false)}
                            className="btn btn-success"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            Reanudar Bot
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsPaused(true)}
                            className="btn btn-secondary text-yellow-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pausar Bot
                        </button>
                    )}
                    <button className="btn btn-secondary text-red-600">
                        Cerrar conversación
                    </button>
                </div>
            </div>

            {/* Status bar */}
            {isPaused && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                        <p className="font-medium text-yellow-800">Bot pausado - Modo handoff activo</p>
                        <p className="text-sm text-yellow-700">El bot no responderá automáticamente. Respondé desde WhatsApp directamente.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chat History */}
                <div className="lg:col-span-2">
                    <div className="card">
                        <div className="p-4 border-b border-[var(--border)]">
                            <h2 className="font-semibold text-slate-900">Historial de mensajes</h2>
                        </div>
                        <div className="p-4 h-[500px] overflow-y-auto bg-slate-50">
                            <div className="flex flex-col gap-4">
                                {messages.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        No hay mensajes en esta conversación
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`message-bubble ${msg.direction === 'in' ? 'inbound' : 'outbound'}`}>
                                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                                <p className={`text-xs mt-1 ${msg.direction === 'out' ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {/* Current Step */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Paso Actual</h3>
                        {currentStep ? (
                            <div className="flow-step">
                                <p className="font-medium text-slate-900 mb-1">{currentStep.title}</p>
                                <p className="text-sm text-slate-500">{currentStep.id}</p>
                            </div>
                        ) : (
                            <p className="text-slate-500">Paso no encontrado</p>
                        )}
                    </div>

                    {/* Tags */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {conversation.tags.length === 0 ? (
                                <p className="text-slate-400 text-sm">Sin tags asignados</p>
                            ) : (
                                conversation.tags.map((tag, i) => (
                                    <span key={i} className="badge badge-info">{tag}</span>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Información</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Flow versión</span>
                                <span className="font-medium">v{conversation.flowVersion}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Creada</span>
                                <span className="font-medium">
                                    {new Date(conversation.createdAt).toLocaleDateString('es-AR')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Última actividad</span>
                                <span className="font-medium">
                                    {new Date(conversation.updatedAt).toLocaleString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
