import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Flow from '@/lib/models/Flow';

// GET /api/flows - List all flows
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const activeOnly = searchParams.get('active') === 'true';

        const query = activeOnly ? { isActive: true } : {};
        const flows = await Flow.find(query).sort({ updatedAt: -1 });

        return NextResponse.json({
            flows: flows.map(f => ({
                id: f._id.toString(),
                name: f.name,
                description: f.description,
                activationRules: f.activationRules,
                draft: f.draft,
                published: f.published,
                publishedVersion: f.publishedVersion,
                isActive: f.isActive,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
            })),
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get flows error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/flows - Create new flow
export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const data = await req.json();

        const flow = await Flow.create({
            name: data.name || 'Nuevo Flujo',
            description: data.description || '',
            activationRules: data.activationRules || {
                sources: { meta_ads: true, organic: true },
                whatsappStatus: { agendado: false, no_agendado: true },
                priority: 1,
            },
            draft: data.draft || {
                entryStepId: 'start',
                steps: {
                    start: {
                        id: 'start',
                        title: 'Inicio',
                        message: 'Hola, ¿en qué puedo ayudarte?',
                        options: [
                            { id: 'opt-1', key: 'A', label: 'Opción 1', nextStepId: 'start' },
                        ],
                    },
                },
            },
            isActive: data.isActive !== undefined ? data.isActive : true,
        });

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
        }, { status: 201 });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Create flow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
