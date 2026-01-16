import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Contact from '@/lib/models/Contact';

// GET /api/contacts - List contacts with filters
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const query: any = {};
        if (status) query.status = status;
        if (search) query.phone = { $regex: search, $options: 'i' };

        const contacts = await Contact.find(query).sort({ lastSeenAt: -1 }).limit(100);

        return NextResponse.json({
            contacts: contacts.map(c => ({
                id: c._id.toString(),
                phone: c.phone,
                firstSeenAt: c.firstSeenAt,
                lastSeenAt: c.lastSeenAt,
                source: c.source,
                status: c.status,
                meta: c.meta,
                tags: c.tags,
            })),
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get contacts error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
