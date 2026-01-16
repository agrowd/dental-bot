import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Contact from '@/lib/models/Contact';
import Conversation from '@/lib/models/Conversation';

// GET /api/stats - Dashboard statistics
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        // Get date ranges
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Count contacts by status
        const [
            totalLeads,
            leadsThisWeek,
            agendados,
            pendientes,
            noAgendados,
            activeConversations,
            pausedConversations,
        ] = await Promise.all([
            Contact.countDocuments(),
            Contact.countDocuments({ firstSeenAt: { $gte: weekAgo } }),
            Contact.countDocuments({ status: 'agendado' }),
            Contact.countDocuments({ status: 'pendiente' }),
            Contact.countDocuments({ status: 'no_agendado' }),
            Conversation.countDocuments({ state: 'active' }),
            Conversation.countDocuments({ state: 'paused' }),
        ]);

        return NextResponse.json({
            totalLeads,
            leadsThisWeek,
            agendados,
            pendientes,
            noAgendados,
            activeConversations,
            pausedConversations,
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get stats error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
