import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Flow from '@/lib/models/Flow';

// POST /api/flows/[id]/publish - Publish draft to production
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(req);
        await dbConnect();

        const flow = await Flow.findById(params.id);

        if (!flow) {
            return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
        }

        // Copy draft to published
        flow.published = flow.draft;
        flow.publishedVersion += 1;
        flow.updatedAt = new Date();

        await flow.save();

        return NextResponse.json({
            flow: {
                id: flow._id.toString(),
                name: flow.name,
                description: flow.description,
                activationRules: flow.activationRules,
                draft: flow.draft,
                published: flow.published,
                publishedVersion: flow.publishedVersion,
                isActive: flow.isActive,
                createdAt: flow.createdAt,
                updatedAt: flow.updatedAt,
            },
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Publish flow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
