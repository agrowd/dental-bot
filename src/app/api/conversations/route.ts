import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Conversation from '@/lib/models/Conversation';

// GET /api/conversations - List conversations
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const conversations = await Conversation.find().sort({ updatedAt: -1 }).limit(100);

        return NextResponse.json({
            conversations: conversations.map(c => ({
                id: c._id.toString(),
                phone: c.phone,
                flowVersion: c.flowVersion,
                currentStepId: c.currentStepId,
                state: c.state,
                tags: c.tags,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            })),
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get conversations error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
