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
    const [newTagInput, setNewTagInput] = useState('');
    const [addingTag, setAddingTag] = useState(false);
    const [editingTag, setEditingTag] = useState<{ index: number; value: string } | null>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const prevMessagesLength = useRef(0);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        fetchData();
        // Poll for new messages every 5 seconds
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [phone]);

    useEffect(() => {
        if (isFirstLoad.current && messages.length > 0) {
            isFirstLoad.current = false;
            prevMessagesLength.current = messages.length;
            return;
        }

        if (!isFirstLoad.current && messages.length > prevMessagesLength.current) {
            scrollToBottom();
            prevMessagesLength.current = messages.length;
        }
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

    const patchConversation = async (body: object) => {
        await fetch(`/api/conversations/${encodeURIComponent(phone)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        await fetchData();
    };

    const handleAddTag = async () => {
        const trimmed = newTagInput.trim();
        if (!trimmed) return;
        await patchConversation({ addTag: trimmed });
        setNewTagInput('');
        setAddingTag(false);
    };

    const handleRemoveTag = async (tag: string) => {
        await patchConversation({ removeTag: tag });
    };

    const handleRenameTag = async (oldTag: string, newTag: string) => {
        if (!newTag.trim() || newTag.trim() === oldTag) { setEditingTag(null); return; }
        const currentTags: string[] = conversation?.tags || [];
        const updatedTags = currentTags.map((t: string) => t === oldTag ? newTag.trim() : t);
        await patchConversation({ tags: updatedTags });
        setEditingTag(null);
    };

    const handleForceBot = async () => {
        if (!confirm(`¿Estás seguro de forzar el inicio del bot para el número ${phone}? Esto interrumpirá la conversación actual.`)) return;

        try {
            setSending(true);
            const res = await fetch('/api/bot/force-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Bot iniciado exitosamente para ' + phone);
                await fetchData(); // Refrescar los mensajes para ver el menù recien enviado
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            console.error('Error forcing bot:', e);
            alert('Error al conectar con el servidor');
        } finally {
            setSending(false);
        }
    };

    const handleForceTransition = async (targetStepId: string) => {
        if (!confirm(`¿Simular que el usuario eligió esta opción? El bot avanzará a: ${targetStepId}`)) return;
        
        try {
            setSending(true);
            const res = await fetch('/api/bot/force-transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, targetStepId })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            console.error('Error forcing transition:', e);
            alert('Error al conectar con el servidor');
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
                        onClick={handleForceBot}
                        disabled={sending}
                        className="btn bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
                    >
                        ▶️ Reiniciar Bot
                    </button>
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

                    {/* Acciones de Bot (Simular Opciones) */}
                    {conversation.currentStepConfig?.options && conversation.currentStepConfig.options.length > 0 && (
                        <div className="card p-4 border-l-4 border-indigo-500">
                            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Forzar Respuesta del Bot
                            </h3>
                            <p className="text-xs text-slate-500 mb-3">Si el usuario no contesta bien, podés simular que eligió una de estas opciones para avanzar el flujo:</p>
                            <div className="space-y-2">
                                {conversation.currentStepConfig.options.map((opt: any, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => handleForceTransition(opt.nextStepId)}
                                        disabled={sending}
                                        className="w-full text-left p-2 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm transition-colors flex justify-between items-center group"
                                    >
                                        <span className="font-medium text-slate-700 group-hover:text-indigo-700">Opción &quot;{opt.key}&quot;</span>
                                        <span className="text-xs text-slate-400 group-hover:text-indigo-500">→ {opt.nextStepId}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags — Editable */}
                    <div className="card p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-900">Tags</h3>
                            <button
                                onClick={() => setAddingTag(true)}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Agregar
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(!conversation.tags || conversation.tags.length === 0) && !addingTag && (
                                <p className="text-slate-400 text-sm">Sin tags asignados</p>
                            )}
                            {(conversation.tags || []).map((tag: string, i: number) => (
                                editingTag?.index === i ? (
                                    <div key={i} className="flex items-center gap-1">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingTag.value}
                                            onChange={e => setEditingTag({ index: i, value: e.target.value })}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRenameTag(tag, editingTag.value);
                                                if (e.key === 'Escape') setEditingTag(null);
                                            }}
                                            className="input py-0.5 px-2 text-xs w-28"
                                        />
                                        <button onClick={() => handleRenameTag(tag, editingTag.value)} className="text-green-600 hover:text-green-700 p-0.5">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                        <button onClick={() => setEditingTag(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <span
                                        key={i}
                                        className={`badge cursor-pointer hover:opacity-80 group flex items-center gap-1 ${tag === 'atencion-requerida' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                            tag === 'otros-temas' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                                'badge-info'
                                            }`}
                                    >
                                        <span
                                            onClick={() => setEditingTag({ index: i, value: tag })}
                                            title="Clic para renombrar"
                                        >{tag}</span>
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="ml-1 text-current opacity-50 hover:opacity-100 transition-opacity"
                                            title="Eliminar tag"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                )
                            ))}
                            {addingTag && (
                                <div className="flex items-center gap-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newTagInput}
                                        onChange={e => setNewTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleAddTag();
                                            if (e.key === 'Escape') { setAddingTag(false); setNewTagInput(''); }
                                        }}
                                        placeholder="nuevo-tag"
                                        className="input py-0.5 px-2 text-xs w-28"
                                    />
                                    <button onClick={handleAddTag} className="text-green-600 hover:text-green-700 p-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                    <button onClick={() => { setAddingTag(false); setNewTagInput(''); }} className="text-slate-400 p-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
