import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Conversation from '@/lib/models/Conversation';

// GET /api/conversations - List conversations
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search');
        const matchStage: any = {};
        
        if (search) {
            const cleanSearch = search.trim().replace(/[\-\+]/g, '');
            matchStage.phone = new RegExp(cleanSearch, 'i');
        }

        // Use aggregation to group by phone and get the most recent conversation for each
        const pipeline: any[] = [];
        if (search) pipeline.push({ $match: matchStage });
        
        pipeline.push(
            { $sort: { updatedAt: -1 } },
            {
                $group: {
                    _id: "$phone",
                    doc: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { updatedAt: -1 } },
            { $limit: search ? 500 : 100 }
        );

        const conversations = await Conversation.aggregate(pipeline);

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
