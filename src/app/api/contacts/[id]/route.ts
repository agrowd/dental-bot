import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Contact from '@/lib/models/Contact';
import Conversation from '@/lib/models/Conversation';
import Message from '@/lib/models/Message';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;

        const contact = await Contact.findById(id);
        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Delete associated data
        await Promise.all([
            Contact.findByIdAndDelete(id),
            Conversation.deleteMany({ phone: contact.phone }),
            Message.deleteMany({ phone: contact.phone })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting contact:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await req.json();

        // Only allow editing safe fields from the CRM
        const ALLOWED_FIELDS = ['name', 'email', 'status', 'tags'];
        const update: Record<string, any> = {};
        for (const field of ALLOWED_FIELDS) {
            if (field in body) update[field] = body[field];
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const contact = await Contact.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true }
        );

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, contact });
    } catch (error) {
        console.error('Error updating contact:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

