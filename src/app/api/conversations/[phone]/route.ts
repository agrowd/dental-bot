import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Conversation from '@/lib/models/Conversation';
import Message from '@/lib/models/Message';

interface RouteParams {
    params: Promise<{
        phone: string;
    }>;
}

// GET /api/conversations/[phone] - Get details and messages
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { phone: rawPhone } = await params;
        const phone = decodeURIComponent(rawPhone);

        // Find the most recent active or paused conversation, or just the latest one
        const conversation = await Conversation.findOne({ phone }).sort({ updatedAt: -1 });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Fetch messages for this phone
        const messages = await Message.find({ phone }).sort({ timestamp: 1 });

        return NextResponse.json({
            conversation: {
                id: conversation._id.toString(),
                phone: conversation.phone,
                flowVersion: conversation.flowVersion,
                currentStepId: conversation.currentStepId,
                state: conversation.state,
                tags: conversation.tags,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            },
            messages: messages.map(m => ({
                id: m._id.toString(),
                text: m.text,
                direction: m.direction,
                timestamp: m.timestamp,
            }))
        });

    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get conversation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/conversations/[phone] - Update state (Pause/Resume)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { phone: rawPhone } = await params;
        const phone = decodeURIComponent(rawPhone);
        const body = await req.json();
        const { state } = body;

        if (!['active', 'paused', 'closed'].includes(state)) {
            return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
        }

        const conversation = await Conversation.findOneAndUpdate(
            { phone, state: { $ne: 'closed' } }, // Only update if not closed (unless forcing reopen?)
            { state },
            { new: true, sort: { updatedAt: -1 } }
        );

        // If no active/paused conversation found, maybe we want to reopen the last closed one?
        // For now, let's assume we operate on the current one.

        if (!conversation) {
            // Try to find ANY conversation to update, even closed ones (reopen case)
            const anyConv = await Conversation.findOneAndUpdate(
                { phone },
                { state },
                { new: true, sort: { updatedAt: -1 } }
            );

            if (!anyConv) {
                return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
            }
            return NextResponse.json({ success: true, conversation: anyConv });
        }

        return NextResponse.json({ success: true, conversation });

    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Update conversation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/conversations/[phone] - Close/Delete conversation
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { phone: rawPhone } = await params;
        const phone = decodeURIComponent(rawPhone);

        // Option A: Hard delete
        // await Conversation.deleteMany({ phone });
        // await Message.deleteMany({ phone });

        // Option B: Soft delete (Mark as closed) - User asked to "eliminar" but UI says "Cerrar".
        // Let's implement Hard Delete for "Eliminar" specifically if queried, but mostly we treat existing "Close" as state=closed.
        // If the user specifically wants to "DELETE", we might need a query param or different handling.
        // For now, let's make DELETE method perform a "Close" (Soft Delete) as is standard for safety, 
        // OR properly implementing HARD DELETE. 
        // Given the request "se pueda eliminar y pausar", "eliminar" means delete from view preferably.
        // Let's implement HARD DELETE for the DELETE verb.

        const result = await Conversation.deleteMany({ phone });
        // We might want to keep messages or delete them? Usually delete everything for that lead.
        await Message.deleteMany({ phone });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deletedCount: result.deletedCount });

    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Delete conversation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
