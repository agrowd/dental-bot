'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { mockFlows } from '@/lib/mock-data';
import { FlowStep, StepOption, ActivationRules } from '@/lib/types';

type TabType = 'rules' | 'steps';

// Generate unique ID
const genId = () => `opt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
const genStepId = () => `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// Next available key (A, B, C... Z, AA, AB...)
const getNextKey = (options: StepOption[]): string => {
    const keys = options.map(o => o.key);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of alphabet) {
        if (!keys.includes(letter)) return letter;
    }
    return `${alphabet.length}`;
};

export default function FlowEditorPage() {
    const params = useParams();
    const flowId = params.flowId as string;

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [activeTab, setActiveTab] = useState<TabType>('steps');
    const [flowName, setFlowName] = useState('');
    const [flowDescription, setFlowDescription] = useState('');
    const [activationRules, setActivationRules] = useState<ActivationRules>({
        sources: { meta_ads: false, organic: true },
        whatsappStatus: { agendado: false, no_agendado: true },
        priority: 1,
        forceRestart: false
    });
    const [isActive, setIsActive] = useState(true);
    const [fallbackMessage, setFallbackMessage] = useState('');
    const [steps, setSteps] = useState<Record<string, FlowStep>>({});
    const [selectedStepId, setSelectedStepId] = useState<string>('');
    const [entryStepId, setEntryStepId] = useState<string>('');
    const [hasChanges, setHasChanges] = useState(false);
    const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showNewStepModal, setShowNewStepModal] = useState(false);
    const [newStepTitle, setNewStepTitle] = useState('');
    const [editingOption, setEditingOption] = useState<StepOption | null>(null);

    const selectedStep = steps[selectedStepId];
    const stepIds = Object.keys(steps);

    // Initial Fetch
    useEffect(() => {
        fetchFlowData();
    }, [flowId]);

    const fetchFlowData = async () => {
        try {
            const res = await fetch(`/api/flows/${flowId}`);
            if (!res.ok) throw new Error('Flow not found');
            const data = await res.json();
            const flow = data.flow;

            setFlowName(flow.name);
            setFlowDescription(flow.description || '');
            setActivationRules(flow.activationRules || {
                sources: { meta_ads: false, organic: true },
                whatsappStatus: { agendado: false, no_agendado: true },
                priority: 1,
                forceRestart: false
            });
            setIsActive(flow.isActive);

            // Use draft data if available, otherwise fallback to published or empty
            const sourceData = flow.draft || flow.published || {};
            setFallbackMessage(sourceData.fallbackMessage || 'No entendí esa opción. Por favor elegí una de las opciones válidas (ej: A).');
            setSteps(sourceData.steps || {});
            setEntryStepId(sourceData.entryStepId || '');
            setSelectedStepId(sourceData.entryStepId || (sourceData.steps ? Object.keys(sourceData.steps)[0] : '') || '');
        } catch (error) {
            console.error('Error loading flow:', error);
            setShowToast({ type: 'error', message: 'Error cargando el flujo' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Handle auto-save from session monitor or logout
    useEffect(() => {
        const handleAutoSave = () => {
            if (hasChanges) {
                console.log('[SESSION] Auto-saving flow due to external request...');
                handleSave();
            }
        };

        window.addEventListener('save-request', handleAutoSave);
        return () => window.removeEventListener('save-request', handleAutoSave);
    }, [hasChanges, flowName, steps, entryStepId, activationRules, isActive]); // Dependencies must cover handleSave needs

    // Create new step
    const handleCreateStep = () => {
        if (!newStepTitle.trim()) return;
        const newId = genStepId();
        setSteps(prev => ({
            ...prev,
            [newId]: {
                id: newId,
                title: newStepTitle,
                message: 'Escribí el mensaje aquí...',
                options: [
                    { id: genId(), key: 'A', label: 'Opción 1', nextStepId: entryStepId }
                ]
            }
        }));
        setSelectedStepId(newId);
        setNewStepTitle('');
        setShowNewStepModal(false);
        setHasChanges(true);
        setShowToast({ type: 'success', message: `Paso "${newStepTitle}" creado` });
    };

    // Delete step
    const handleDeleteStep = (stepId: string) => {
        if (stepId === entryStepId) {
            setShowToast({ type: 'error', message: 'No podés eliminar el paso inicial' });
            return;
        }
        if (stepIds.length <= 1) {
            setShowToast({ type: 'error', message: 'Debe haber al menos un paso' });
            return;
        }
        const { [stepId]: removed, ...rest } = steps;
        setSteps(rest);
        setSelectedStepId(entryStepId);
        setHasChanges(true);
    };

    // Update step field
    const updateStep = (field: keyof FlowStep, value: string | StepOption[]) => {
        setSteps(prev => ({
            ...prev,
            [selectedStepId]: { ...prev[selectedStepId], [field]: value }
        }));
        setHasChanges(true);
    };

    // Add option to current step
    const addOption = () => {
        const currentOptions = selectedStep.options;
        const newOption: StepOption = {
            id: genId(),
            key: getNextKey(currentOptions),
            label: 'Nueva opción',
            nextStepId: entryStepId
        };
        updateStep('options', [...currentOptions, newOption]);
    };

    // Remove option
    const removeOption = (optionId: string) => {
        if (selectedStep.options.length <= 1) {
            setShowToast({ type: 'error', message: 'Debe haber al menos una opción' });
            return;
        }
        const filtered = selectedStep.options.filter(o => o.id !== optionId);
        // Re-key the options (A, B, C...)
        const reKeyed = filtered.map((opt, i) => ({
            ...opt,
            key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || `${i + 1}`
        }));
        updateStep('options', reKeyed);
    };

    // Update option
    const updateOption = (optionId: string, field: 'label' | 'nextStepId', value: string) => {
        const updated = selectedStep.options.map(opt =>
            opt.id === optionId ? { ...opt, [field]: value } : opt
        );
        updateStep('options', updated);
    };

    // Move option up/down
    const moveOption = (optionId: string, direction: 'up' | 'down') => {
        const idx = selectedStep.options.findIndex(o => o.id === optionId);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === selectedStep.options.length - 1) return;

        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        const newOptions = [...selectedStep.options];
        [newOptions[idx], newOptions[newIdx]] = [newOptions[newIdx], newOptions[idx]];

        // Re-key
        const reKeyed = newOptions.map((opt, i) => ({
            ...opt,
            key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || `${i + 1}`
        }));
        updateStep('options', reKeyed);
    };

    const handleSave = async () => {
        const payload = {
            name: flowName,
            description: flowDescription,
            activationRules, // Check if this is correct
            draft: { steps, entryStepId, fallbackMessage },
            isActive
        };
        console.log('[DEBUG-FRONTEND] Saving flow payload:', JSON.stringify(payload, null, 2));

        try {
            const res = await fetch(`/api/flows/${flowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            console.log('[DEBUG-FRONTEND] Save response:', data);

            if (res.ok) {
                setHasChanges(false);
                setShowToast({ type: 'success', message: 'Cambios guardados' });
            } else {
                setShowToast({ type: 'error', message: 'Error al guardar' });
            }
        } catch (e) {
            console.error('[DEBUG-FRONTEND] Save error:', e);
            setShowToast({ type: 'error', message: 'Error de conexión' });
        }
    };

    const handlePublish = async () => {
        console.log('[DEBUG-FRONTEND] Publishing flow:', flowId);
        try {
            const res = await fetch(`/api/flows/${flowId}/publish`, { method: 'POST' });
            const data = await res.json();
            console.log('[DEBUG-FRONTEND] Publish response:', data);

            if (res.ok) {
                setHasChanges(false);
                setShowToast({ type: 'success', message: '¡Flujo publicado!' });
            } else {
                setShowToast({ type: 'error', message: 'Error al publicar' });
            }
        } catch (e) {
            console.error('[DEBUG-FRONTEND] Publish error:', e);
            setShowToast({ type: 'error', message: 'Error de conexión' });
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar este flujo? Esta acción no se puede deshacer.')) return;

        try {
            const res = await fetch(`/api/flows/${flowId}`, { method: 'DELETE' });
            if (res.ok) {
                window.location.href = '/admin/flows';
            } else {
                setShowToast({ type: 'error', message: 'Error al eliminar el flujo' });
            }
        } catch (e) {
            console.error('Delete error:', e);
            setShowToast({ type: 'error', message: 'Error de conexión' });
        }
    };

    // Generate preview text
    const generatePreview = (step: FlowStep): string => {
        let preview = step.message + '\n\n';
        step.options.forEach(opt => {
            preview += `${opt.key}) ${opt.label}\n`;
        });
        return preview;
    };

    if (loading) {
        return <div className="p-8 text-center bg-slate-50 min-h-screen">Cargando flujo...</div>;
    }

    return (
        <div className="animate-fadeIn h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/flows" className="p-2 hover:bg-slate-100 rounded-lg">
                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-slate-900">{flowName || 'Nuevo Flujo'}</h1>
                            {hasChanges && <span className="badge badge-warning">Sin guardar</span>}

                            {/* Active Toggle */}
                            <label className={`relative inline-flex items-center cursor-pointer`}>
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isActive}
                                    onChange={(e) => { setIsActive(e.target.checked); setHasChanges(true); }}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                <span className="ml-2 text-sm font-medium text-slate-900">{isActive ? 'Activo' : 'Inactivo'}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
                        Eliminar
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-2"></div>
                    <button onClick={handleSave} disabled={saving} className="btn btn-secondary">
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={handlePublish} disabled={publishing} className="btn btn-success">
                        {publishing ? 'Publicando...' : 'Publicar'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'rules' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    ⚙️ Reglas
                </button>
                <button onClick={() => setActiveTab('steps')} className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'steps' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    📝 Constructor de Menús
                </button>
            </div>

            {/* Rules Tab */}
            {activeTab === 'rules' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl space-y-4">
                        <div className="card p-4">
                            <label className="label">Nombre</label>
                            <input type="text" value={flowName} onChange={(e) => { setFlowName(e.target.value); setHasChanges(true); }} className="input" />
                        </div>
                        <div className="card p-4">
                            <label className="label">Descripción</label>
                            <input type="text" value={flowDescription} onChange={(e) => { setFlowDescription(e.target.value); setHasChanges(true); }} className="input" />
                        </div>
                        <div className="card p-4">
                            <h3 className="font-medium text-slate-900 mb-3">Origen</h3>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer flex items-center gap-3 ${activationRules.sources.meta_ads ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                    <input type="checkbox" checked={activationRules.sources.meta_ads} onChange={(e) => { setActivationRules(prev => ({ ...prev, sources: { ...prev.sources, meta_ads: e.target.checked } })); setHasChanges(true); }} />
                                    <span>📢 Meta Ads</span>
                                </label>
                                <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer flex items-center gap-3 ${activationRules.sources.organic ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                    <input type="checkbox" checked={activationRules.sources.organic} onChange={(e) => { setActivationRules(prev => ({ ...prev, sources: { ...prev.sources, organic: e.target.checked } })); setHasChanges(true); }} />
                                    <span>💬 Orgánico</span>
                                </label>
                            </div>
                        </div>
                        <div className="card p-4">
                            <h3 className="font-medium text-slate-900 mb-3">Estado en WhatsApp</h3>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer flex items-center gap-3 ${activationRules.whatsappStatus.agendado ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}>
                                    <input type="checkbox" checked={activationRules.whatsappStatus.agendado} onChange={(e) => { setActivationRules(prev => ({ ...prev, whatsappStatus: { ...prev.whatsappStatus, agendado: e.target.checked } })); setHasChanges(true); }} />
                                    <div>
                                        <span className="font-medium">📇 Agendado</span>
                                        <p className="text-xs text-slate-500">Número guardado</p>
                                    </div>
                                </label>
                                <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer flex items-center gap-3 ${activationRules.whatsappStatus.no_agendado ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200'}`}>
                                    <input type="checkbox" checked={activationRules.whatsappStatus.no_agendado} onChange={(e) => { setActivationRules(prev => ({ ...prev, whatsappStatus: { ...prev.whatsappStatus, no_agendado: e.target.checked } })); setHasChanges(true); }} />
                                    <div>
                                        <span className="font-medium">❓ No agendado</span>
                                        <p className="text-xs text-slate-500">Número desconocido</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="card p-4">
                            <h3 className="font-medium text-slate-900 mb-3">Prioridad</h3>
                            <div className="flex items-center gap-3">
                                <input type="number" min="1" max="100" value={activationRules.priority} onChange={(e) => { setActivationRules(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 })); setHasChanges(true); }} className="input w-20 text-center" />
                                <span className="text-sm text-slate-500">Mayor = más prioridad</span>
                            </div>
                        </div>

                        {/* Force Restart Option */}
                        <div className="card p-4">
                            <h3 className="font-medium text-slate-900 mb-2">Comportamiento de Inicio</h3>
                            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={activationRules.forceRestart || false}
                                    onChange={(e) => {
                                        setActivationRules(prev => ({ ...prev, forceRestart: e.target.checked }));
                                        setHasChanges(true);
                                    }}
                                    className="mt-1"
                                />
                                <div>
                                    <span className="font-medium text-slate-900">⚡ Reinicio Forzado (Siempre responder)</span>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Si se activa, el bot interrumpirá cualquier conversación anterior y reiniciará el flujo desde cero. útil para menús principales.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Fallback Message Setting */}
                        <div className="card p-4">
                            <h3 className="font-medium text-slate-900 mb-2">Mensaje de "Opción no válida"</h3>
                            <p className="text-xs text-slate-500 mb-3">
                                Este mensaje se enviará automáticamente si el usuario escribe algo que no coincide con las opciones del paso actual.
                            </p>
                            <textarea
                                value={fallbackMessage}
                                onChange={(e) => { setFallbackMessage(e.target.value); setHasChanges(true); }}
                                className="input min-h-[100px] w-full text-sm"
                                placeholder="Ej: No entendí esa opción. Por favor elegí una de las opciones válidas (ej: A)."
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Steps Tab - Visual Builder */}
            {activeTab === 'steps' && (
                <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
                    {/* Steps List */}
                    <div className="col-span-3 card flex flex-col min-h-0">
                        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                            <h2 className="font-semibold text-slate-900 text-sm">Pasos ({stepIds.length})</h2>
                            <button onClick={() => setShowNewStepModal(true)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700" title="Agregar paso">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {stepIds.map((stepId) => {
                                const step = steps[stepId];
                                const isEntry = stepId === entryStepId;
                                const isSelected = stepId === selectedStepId;
                                return (
                                    <button
                                        key={stepId}
                                        onClick={() => setSelectedStepId(stepId)}
                                        className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-100 border-2 border-blue-500' : 'hover:bg-slate-100 border-2 border-transparent'} ${isEntry ? 'ring-2 ring-green-400' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-900 truncate">{step.title}</span>
                                            {isEntry && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">Inicio</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">{step.options.length} opciones</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step Editor */}
                    <div className="col-span-5 card flex flex-col min-h-0">
                        {selectedStep && (
                            <>
                                <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                                    <h2 className="font-semibold text-slate-900 text-sm">✏️ Editando: {selectedStep.title}</h2>
                                    <div className="flex items-center gap-2">
                                        {selectedStepId !== entryStepId && (
                                            <button onClick={() => { setEntryStepId(selectedStepId); setHasChanges(true); }} className="text-xs text-green-600 hover:underline">
                                                Hacer inicio
                                            </button>
                                        )}
                                        {selectedStepId !== entryStepId && (
                                            <button onClick={() => handleDeleteStep(selectedStepId)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Title */}
                                    <div>
                                        <label className="label text-xs">Título del paso</label>
                                        <input
                                            type="text"
                                            value={selectedStep.title}
                                            onChange={(e) => updateStep('title', e.target.value)}
                                            className="input text-sm"
                                            placeholder="Ej: Bienvenida, Selección, etc."
                                        />
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <label className="label text-xs">Mensaje del bot</label>
                                        <textarea
                                            value={selectedStep.message}
                                            onChange={(e) => updateStep('message', e.target.value)}
                                            className="input min-h-[80px] resize-y text-sm"
                                            placeholder="Escribí el mensaje que verá el usuario..."
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Tip: Usá emojis para hacerlo más amigable 👋</p>
                                    </div>

                                    {/* Options */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="label text-xs mb-0">Opciones del menú</label>
                                            <button onClick={addOption} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Agregar opción
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedStep.options.map((opt, idx) => (
                                                <div key={opt.id} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors group">
                                                    {/* Key badge */}
                                                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center flex-shrink-0 border border-slate-200">
                                                        {opt.key}
                                                    </span>

                                                    {/* Label display */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-slate-900 truncate" title={opt.label}>
                                                            {opt.label || 'Sin texto'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                                            <span>→</span>
                                                            <span className="truncate max-w-[150px]">
                                                                {steps[opt.nextStepId]?.title || 'Paso no encontrado'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setEditingOption(opt)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                            title="Editar opción"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>

                                                        <div className="flex flex-col">
                                                            <button onClick={() => moveOption(opt.id, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" disabled={idx === 0}>
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                            </button>
                                                            <button onClick={() => moveOption(opt.id, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" disabled={idx === selectedStep.options.length - 1}>
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                            </button>
                                                        </div>

                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                        <button
                                                            onClick={() => removeOption(opt.id)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                            title="Eliminar opción"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div>
                                        <label className="label text-xs">Acciones automáticas</label>
                                        <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStep.actions?.pauseConversation || false}
                                                    onChange={(e) => {
                                                        setSteps(prev => ({
                                                            ...prev,
                                                            [selectedStepId]: {
                                                                ...prev[selectedStepId],
                                                                actions: { ...prev[selectedStepId].actions, pauseConversation: e.target.checked }
                                                            }
                                                        }));
                                                        setHasChanges(true);
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm">👤 Pausar bot (handoff a humano)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="col-span-4 card flex flex-col min-h-0 bg-gradient-to-b from-green-50 to-green-100">
                        <div className="p-3 border-b border-green-200">
                            <h2 className="font-semibold text-green-900 text-sm">📱 Vista Previa</h2>
                            <p className="text-xs text-green-700">Así se verá en WhatsApp</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedStep && (
                                <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm max-w-[280px]">
                                    <p className="text-sm whitespace-pre-wrap text-slate-800">
                                        {selectedStep.message}
                                    </p>
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        {selectedStep.options.map((opt) => (
                                            <div key={opt.id} className="text-sm text-slate-700 py-1">
                                                <span className="font-medium text-blue-600">{opt.key})</span> {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Step Modal */}
            {showNewStepModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewStepModal(false)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Crear nuevo paso</h3>
                        <p className="text-sm text-slate-500 mb-4">Dale un nombre descriptivo a este paso del flujo.</p>

                        <div className="mb-6">
                            <label className="label">Nombre del paso</label>
                            <input
                                type="text"
                                value={newStepTitle}
                                onChange={(e) => setNewStepTitle(e.target.value)}
                                placeholder="Ej: Selección de Servicio"
                                className="input w-full"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateStep()}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                            <button onClick={() => setShowNewStepModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateStep}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                disabled={!newStepTitle.trim()}
                            >
                                Crear Paso
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Option Modal */}
            {editingOption && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingOption(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-900">
                                Editar Opción <span className="text-blue-600">{editingOption.key}</span>
                            </h3>
                            <button onClick={() => setEditingOption(null)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Texto de la opción</label>
                                <input
                                    type="text"
                                    value={editingOption.label}
                                    onChange={(e) => setEditingOption({ ...editingOption, label: e.target.value })}
                                    className="input w-full text-lg"
                                    placeholder="Ej: Ver horarios disponibles"
                                    autoFocus
                                />
                                <p className="text-xs text-slate-500 mt-1">Este es el texto que verá el usuario en el menú.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Acción al seleccionar</label>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-sm text-slate-600 mb-2">Ir al siguiente paso:</div>
                                    <select
                                        value={editingOption.nextStepId}
                                        onChange={(e) => setEditingOption({ ...editingOption, nextStepId: e.target.value })}
                                        className="input w-full bg-white font-medium"
                                    >
                                        {stepIds.map((id) => (
                                            <option key={id} value={id}>
                                                {id === entryStepId ? '🏁 ' : ''}{steps[id].title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                            <button onClick={() => setEditingOption(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (editingOption) {
                                        // Update label
                                        updateOption(editingOption.id, 'label', editingOption.label);
                                        // Update nextStepId
                                        updateOption(editingOption.id, 'nextStepId', editingOption.nextStepId);
                                        setEditingOption(null);
                                    }
                                }}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md shadow-blue-200 transition-all transform active:scale-95"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {showToast && (
                <div className={`toast ${showToast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                    {showToast.message}
                </div>
            )}
        </div>
    );
}
