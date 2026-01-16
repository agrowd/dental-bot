'use client';

import { useState, useRef, useEffect } from 'react';
import { mockFlow } from '@/lib/mock-data';
import { FlowStep } from '@/lib/types';

interface SimMessage {
    id: string;
    direction: 'in' | 'out';
    text: string;
}

export default function SimulatorPage() {
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [currentStepId, setCurrentStepId] = useState<string>(mockFlow.draft.entryStepId);
    const [inputText, setInputText] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const steps = mockFlow.draft.steps;
    const currentStep = steps[currentStepId];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (messages.length === 0) {
            sendBotMessage(currentStep);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderMenu = (step: FlowStep): string => {
        let menu = step.message + '\n\n';
        step.options.forEach(opt => {
            menu += `${opt.key}) ${opt.label}\n`;
        });
        return menu.trim();
    };

    const sendBotMessage = (step: FlowStep) => {
        const text = renderMenu(step);
        setMessages(prev => [...prev, {
            id: `bot-${Date.now()}`,
            direction: 'out',
            text
        }]);

        if (step.actions?.pauseConversation) {
            setIsPaused(true);
        }
    };

    const findOptionByKey = (step: FlowStep, inputKey: string) => {
        return step.options.find(opt => opt.key.toUpperCase() === inputKey.toUpperCase());
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        setMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            direction: 'in',
            text: inputText
        }]);

        const input = inputText;
        setInputText('');

        // If paused, bot doesn't respond
        if (isPaused) {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: `system-${Date.now()}`,
                    direction: 'out',
                    text: '⚠️ [Bot pausado - Modo handoff activo]\nEl bot no responde automáticamente. Un humano debería responder.'
                }]);
            }, 500);
            return;
        }

        // Process input
        setTimeout(() => {
            const matchedOption = findOptionByKey(currentStep, input.trim());

            if (matchedOption) {
                // Valid input - advance to next step
                const nextStep = steps[matchedOption.nextStepId];
                if (nextStep) {
                    setCurrentStepId(matchedOption.nextStepId);
                    sendBotMessage(nextStep);
                }
            } else {
                // Invalid input - resend current menu
                setMessages(prev => [...prev, {
                    id: `bot-invalid-${Date.now()}`,
                    direction: 'out',
                    text: '⚠️ Para avanzar, elegí una de las opciones disponibles.\n\n' + renderMenu(currentStep)
                }]);
            }
        }, 500);
    };

    const handleReset = () => {
        setMessages([]);
        setCurrentStepId(mockFlow.draft.entryStepId);
        setIsPaused(false);
        setTimeout(() => {
            sendBotMessage(steps[mockFlow.draft.entryStepId]);
        }, 100);
    };

    const handleResume = () => {
        setIsPaused(false);
        setMessages(prev => [...prev, {
            id: `system-resume-${Date.now()}`,
            direction: 'out',
            text: '✅ [Bot reanudado]\n\n' + renderMenu(currentStep)
        }]);
    };

    return (
        <div className="animate-fadeIn h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Simulador</h1>
                    <p className="text-slate-500 mt-1">Probá cómo responde el bot antes de publicar</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleReset} className="btn btn-secondary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reiniciar
                    </button>
                    {isPaused && (
                        <button onClick={handleResume} className="btn btn-success">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            Reanudar Bot
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Chat Window */}
                <div className="col-span-8 card flex flex-col">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Bot Clínica Dental</p>
                            <p className="text-sm text-green-600 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                {isPaused ? 'Pausado (Handoff)' : 'Activo'}
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.direction === 'out' ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`message-bubble ${msg.direction === 'in' ? 'inbound' : 'outbound'}`}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border)]">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Escribí tu mensaje..."
                                className="input flex-1"
                            />
                            <button type="submit" className="btn btn-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Tip: Probá responder con las letras de las opciones o cualquier texto
                        </p>
                    </form>
                </div>

                {/* Info Panel */}
                <div className="col-span-4 space-y-6">
                    {/* Current Step */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Estado actual</h3>
                        <div className="space-y-3">
                            <div className="flow-step">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-slate-900">{currentStep.title}</span>
                                    {currentStepId === mockFlow.draft.entryStepId && (
                                        <span className="badge badge-success text-xs">Inicio</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">{currentStepId}</p>
                            </div>

                            <div className="text-sm">
                                <p className="text-slate-500 mb-2">Opciones disponibles:</p>
                                <div className="space-y-1">
                                    {currentStep.options.map((opt) => (
                                        <div key={opt.id} className="flex items-center gap-2 text-slate-600">
                                            <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">
                                                {opt.key}
                                            </span>
                                            <span className="text-xs flex-1 truncate">{opt.label}</span>
                                            <span className="text-xs text-slate-400">→ {steps[opt.nextStepId]?.title || opt.nextStepId}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Flow Rules */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Reglas del bot</h3>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Acepta las letras de las opciones del menú</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">✗</span>
                                <span>Cualquier otro texto: reenvía menú</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-yellow-500 mt-0.5">⏸</span>
                                <span>Handoff: el bot deja de responder</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Test Buttons */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 mb-3">Respuestas rápidas</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {currentStep.options.slice(0, 8).map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setInputText(opt.key)}
                                    className="btn btn-secondary py-2"
                                    title={opt.label}
                                >
                                    {opt.key}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setInputText('hola')}
                                className="btn btn-secondary py-2 text-sm"
                            >
                                "hola"
                            </button>
                            <button
                                onClick={() => setInputText('??')}
                                className="btn btn-secondary py-2 text-sm"
                            >
                                "??"
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
