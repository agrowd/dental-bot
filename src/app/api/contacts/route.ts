import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Contact from '@/lib/models/Contact';
import Conversation from '@/lib/models/Conversation';

// GET /api/contacts - List contacts enriched with latest conversation state
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const query: any = {};
        if (status && status !== 'all' && status !== 'paused') query.status = status;
        
        if (search) {
            const cleanSearch = search.trim().replace(/[\-\+]/g, '');
            const regex = new RegExp(cleanSearch, 'i');
            query.$or = [
                { phone: regex },
                { name: regex },
                { pushname: regex },
                { email: regex }
            ];
        }

        const contacts = await Contact.find(query).sort({ lastSeenAt: -1 }).limit(search ? 500 : 200);

        // Fetch latest active/paused conversation for each contact in one query
        const phones = contacts.map(c => c.phone);
        const conversations = await Conversation.find(
            { phone: { $in: phones }, state: { $in: ['active', 'paused'] } },
            { phone: 1, state: 1, tags: 1, currentStepId: 1, forceUnread: 1 }
        ).sort({ updatedAt: -1 });

        // Build a map: phone -> latest conversation
        const convMap = new Map<string, any>();
        for (const conv of conversations) {
            if (!convMap.has(conv.phone)) {
                convMap.set(conv.phone, conv);
            }
        }

        return NextResponse.json({
            contacts: contacts.map(c => {
                const conv = convMap.get(c.phone);
                return {
                    id: c._id.toString(),
                    _id: c._id.toString(),
                    phone: c.phone,
                    name: c.name,
                    pushname: c.pushname,
                    email: c.email,
                    firstSeenAt: c.firstSeenAt,
                    lastSeenAt: c.lastSeenAt,
                    source: c.source,
                    status: c.status,
                    meta: c.meta,
                    tags: c.tags || [],
                    conversationState: conv?.state || null,
                    conversationTags: conv?.tags || [],
                    currentStepId: conv?.currentStepId || null,
                };
            }),
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get contacts error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

