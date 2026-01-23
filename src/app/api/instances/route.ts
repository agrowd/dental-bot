import { NextRequest, NextResponse } from 'next/server';
import { InstanceManager } from '@/lib/instance-manager';

export async function GET() {
    try {
        const instances = await InstanceManager.listInstances();
        return NextResponse.json(instances);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { action, name, id } = await req.json();

        switch (action) {
            case 'create':
                const newInstance = await InstanceManager.createInstance(name);
                return NextResponse.json(newInstance);

            case 'start':
                await InstanceManager.startInstance(id);
                return NextResponse.json({ success: true });

            case 'stop':
                await InstanceManager.stopInstance(id);
                return NextResponse.json({ success: true });

            case 'delete':
                await InstanceManager.deleteInstance(id);
                return NextResponse.json({ success: true });

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
