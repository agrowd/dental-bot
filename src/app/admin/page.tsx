'use client';

import { useEffect, useState } from 'react';

// Stat card component
function StatCard({
    title,
    value,
    subtitle,
    icon,
    color
}: {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        red: 'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600'
    };

    return (
        <div className="card p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                    {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-xl ${colors[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// Recent activity item
function ActivityItem({
    phone,
    action,
    time,
    icon
}: {
    phone: string;
    action: string;
    time: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-4 py-3">
            <div className="p-2 rounded-lg bg-slate-100">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{phone}</p>
                <p className="text-sm text-slate-500 truncate">{action}</p>
            </div>
            <span className="text-xs text-slate-400">{time}</span>
        </div>
    );
}

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch stats
                const statsRes = await fetch('/api/stats');
                const statsData = await statsRes.json();
                setStats(statsData);

                // Fetch recent contacts
                const contactsRes = await fetch('/api/contacts?limit=3');
                const contactsData = await contactsRes.json();
                setContacts(contactsData.contacts || []);

                // Fetch recent conversations
                const conversationsRes = await fetch('/api/conversations?limit=3');
                const conversationsData = await conversationsRes.json();
                setConversations(conversationsData.conversations || []);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500 mt-1">Resumen de actividad del bot</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Leads"
                    value={stats?.totalLeads || 0}
                    subtitle={`+${stats?.leadsThisWeek || 0} esta semana`}
                    color="blue"
                    icon={
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    }
                />
                <StatCard
                    title="Agendados"
                    value={stats?.agendados || 0}
                    subtitle={stats?.totalLeads > 0 ? `${Math.round((stats?.agendados || 0) / stats.totalLeads * 100)}% conversión` : '0% conversión'}
                    color="green"
                    icon={
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard
                    title="Pendientes"
                    value={stats?.pendientes || 0}
                    color="yellow"
                    icon={
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard
                    title="Conversaciones Activas"
                    value={stats?.activeConversations || 0}
                    subtitle={`${stats?.pausedConversations || 0} en pausa`}
                    color="purple"
                    icon={
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    }
                />
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Leads */}
                <div className="card">
                    <div className="p-6 border-b border-[var(--border)]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Leads Recientes</h2>
                            <a href="/admin/leads" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                                Ver todos →
                            </a>
                        </div>
                    </div>
                    <div className="p-6 divide-y divide-[var(--border)]">
                        {contacts.length > 0 ? contacts.map((lead: any) => (
                            <ActivityItem
                                key={lead._id}
                                phone={lead.phone}
                                action={`${lead.source === 'meta_ads' ? 'Meta Ads' : 'Orgánico'} • ${lead.status}`}
                                time={new Date(lead.lastSeenAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                icon={
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                }
                            />
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-8">No hay leads recientes</p>
                        )}
                    </div>
                </div>

                {/* Recent Conversations */}
                <div className="card">
                    <div className="p-6 border-b border-[var(--border)]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Conversaciones Activas</h2>
                            <a href="/admin/conversations" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                                Ver todas →
                            </a>
                        </div>
                    </div>
                    <div className="p-6 divide-y divide-[var(--border)]">
                        {conversations.length > 0 ? conversations.map((conv: any) => (
                            <ActivityItem
                                key={conv._id}
                                phone={conv.phone}
                                action={`Step: ${conv.currentStepId} • ${conv.state === 'paused' ? '⏸️ Pausado' : '🟢 Activo'}`}
                                time={new Date(conv.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                icon={
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                }
                            />
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-8">No hay conversaciones activas</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Acciones Rápidas</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="/admin/flows" className="card p-6 hover:shadow-md transition-all hover:border-blue-200 group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Editar Flujo</p>
                                <p className="text-sm text-slate-500">Modificar respuestas del bot</p>
                            </div>
                        </div>
                    </a>

                    <a href="/admin/simulator" className="card p-6 hover:shadow-md transition-all hover:border-green-200 group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Probar Bot</p>
                                <p className="text-sm text-slate-500">Simular conversación</p>
                            </div>
                        </div>
                    </a>

                    <a href="/admin/leads?status=pendiente" className="card p-6 hover:shadow-md transition-all hover:border-yellow-200 group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Leads Pendientes</p>
                                <p className="text-sm text-slate-500">{stats?.pendientes || 0} por atender</p>
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}
