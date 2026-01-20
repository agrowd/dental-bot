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
