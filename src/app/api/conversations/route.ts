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
        const filter = searchParams.get('filter');
        const matchStage: any = {};
        
        if (filter === 'unread') {
            matchStage.hasUnread = true;
        }

        if (search) {
            const cleanSearch = search.trim().replace(/[\s\-\+]/g, '');
            
            // Normalize Argentine prefixes and other local search formats (strip leading 549, 54, 0, 15)
            let prefixStrippedPhone = cleanSearch;
            if (prefixStrippedPhone.startsWith('549')) {
                prefixStrippedPhone = prefixStrippedPhone.substring(3);
            } else if (prefixStrippedPhone.startsWith('54')) {
                prefixStrippedPhone = prefixStrippedPhone.substring(2);
                if (prefixStrippedPhone.startsWith('9')) {
                    prefixStrippedPhone = prefixStrippedPhone.substring(1);
                }
            }
            if (prefixStrippedPhone.startsWith('0')) {
                prefixStrippedPhone = prefixStrippedPhone.substring(1);
            }
            if (prefixStrippedPhone.startsWith('15')) {
                prefixStrippedPhone = prefixStrippedPhone.substring(2);
            }

            matchStage.$or = [
                { phone: new RegExp(cleanSearch, 'i') },
                { phone: new RegExp(prefixStrippedPhone, 'i') }
            ];
        }

        // Use aggregation to group by phone and get the most recent conversation for each
        const pipeline: any[] = [];
        if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
        
        pipeline.push(
            { $sort: { updatedAt: -1 } },
            {
                $group: {
                    _id: "$phone",
                    doc: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$doc" } },
            {
                $lookup: {
                    from: "contacts",
                    localField: "phone",
                    foreignField: "phone",
                    as: "contactDoc"
                }
            },
            { $sort: { updatedAt: -1 } },
            { $limit: search ? 500 : 150 }
        );

        const conversations = await Conversation.aggregate(pipeline);

        return NextResponse.json({
            conversations: conversations.map(c => ({
                id: c._id.toString(),
                phone: c.phone,
                contactName: c.contactDoc?.[0]?.name || c.contactDoc?.[0]?.pushname || '',
                flowVersion: c.flowVersion,
                currentStepId: c.currentStepId,
                state: c.state,
                tags: c.tags || [],
                hasUnread: !!c.hasUnread,
                unreadCount: c.unreadCount || 0,
                lastMessageText: c.lastMessageText || '',
                lastMessageAt: c.lastMessageAt || c.updatedAt,
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
