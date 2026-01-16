import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Flow from '@/lib/models/Flow';

// GET /api/flows/[id]
export async function GET(
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
        console.error('Get flow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/flows/[id] - Update draft
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(req);
        await dbConnect();

        const data = await req.json();

        const flow = await Flow.findByIdAndUpdate(
            params.id,
            {
                name: data.name,
                description: data.description,
                activationRules: data.activationRules,
                draft: data.draft,
                isActive: data.isActive,
                updatedAt: new Date(),
            },
            { new: true }
        );

        if (!flow) {
            return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
        }

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
        console.error('Update flow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/flows/[id]
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(req);
        await dbConnect();

        const flow = await Flow.findByIdAndDelete(params.id);

        if (!flow) {
            return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Delete flow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
