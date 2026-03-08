import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Conversation from '@/lib/models/Conversation';

const ATTENTION_TAGS = ['atencion-requerida', 'otros-temas'];

// GET /api/attention-count — returns number of conversations needing human attention
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const count = await Conversation.countDocuments({
            state: { $in: ['active', 'paused'] },
            tags: { $in: ATTENTION_TAGS }
        });

        return NextResponse.json({ count });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        return NextResponse.json({ count: 0 });
    }
}
