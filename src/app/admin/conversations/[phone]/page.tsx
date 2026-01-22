'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const phone = decodeURIComponent(params.phone as string);

    const [conversation, setConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        fetchData();
        // Poll for new messages every 5 seconds
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [phone]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    async function fetchData() {
        try {
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`);
            if (res.ok) {
                const data = await res.json();
                setConversation(data.conversation);
                setMessages(data.messages || []);
            } else {
                if (loading) setConversation(null); // Only nullify if initial load
            }
        } catch (error) {
            console.error('Error fetching conversation:', error);
        } finally {
            setLoading(false);
        }
    }

    const handlePause = async () => {
        try {
            setSending(true);
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: 'paused' })
            });
            if (res.ok) {
                await fetchData();
            }
        } finally {
            setSending(false);
        }
    };

    const handleResume = async () => {
        try {
            setSending(true);
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: 'active' })
            });
            if (res.ok) {
                await fetchData();
            }
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar esta conversación y todo su historial?')) return;

        try {
            setSending(true);
            const res = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                router.push('/admin/conversations');
            } else {
                alert('Error al eliminar conversación');
            }
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="animate-fadeIn">
                <div className="card p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Conversación no encontrada</h2>
                    <p className="text-slate-500 mb-4">No existe historial para {phone}. Es posible que se haya eliminado.</p>
                    <Link href="/admin/conversations" className="btn btn-primary">
                        Volver a conversaciones
                    </Link>
                </div>
            </div>
        );
    }

    const isPaused = conversation.state === 'paused';

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
                    <p className="text-slate-500">
                        Iniciada {new Date(conversation.createdAt).toLocaleDateString('es-AR')} •
                        <span className={`ml-2 badge ${isPaused ? 'badge-warning' : 'badge-success'}`}>
                            {isPaused ? 'Pausado' : 'Activo'}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isPaused ? (
                        <button
                            onClick={handleResume}
                            disabled={sending}
                            className="btn btn-success"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            Reanudar Bot
                        </button>
                    ) : (
                        <button
                            onClick={handlePause}
                            disabled={sending}
                            className="btn btn-secondary text-yellow-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pausar Bot
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        disabled={sending}
                        className="btn btn-secondary text-red-600"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
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
                        <p className="font-medium text-yellow-800">Bot pausado - Intervención Manual</p>
                        <p className="text-sm text-yellow-700">El bot no responderá automáticamente. Puedes escribir desde WhatsApp Web.</p>
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
                        <div className="p-4 h-[600px] overflow-y-auto bg-slate-50 flex flex-col">
                            <div className="flex flex-col gap-4 flex-1">
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
                                            <div className={`message-bubble ${msg.direction === 'in' ? 'inbound' : 'outbound'} max-w-[80%]`}>
                                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                                <p className={`text-xs mt-1 text-right ${msg.direction === 'out' ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {/* Info */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Detalles</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Paso actual ID</span>
                                <span className="font-medium truncate max-w-[150px]">{conversation.currentStepId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Flow versión</span>
                                <span className="font-medium">v{conversation.flowVersion}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Última actividad</span>
                                <span className="font-medium">
                                    {new Date(conversation.updatedAt).toLocaleString('es-AR', {
                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {(!conversation.tags || conversation.tags.length === 0) ? (
                                <p className="text-slate-400 text-sm">Sin tags asignados</p>
                            ) : (
                                conversation.tags.map((tag: string, i: number) => (
                                    <span key={i} className="badge badge-info">{tag}</span>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
