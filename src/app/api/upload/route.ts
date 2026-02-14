import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure upload directory exists
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Ignore if directory already exists
        }

        // Generate unique filename
        const originalName = file.name;
        const extension = originalName.split('.').pop();
        const fileName = `${uuidv4()}.${extension}`;
        const path = join(uploadDir, fileName);

        // Write file
        await writeFile(path, buffer);
        console.log(`[UPLOAD] File saved to ${path}`);

        const url = `/uploads/${fileName}`;
        return NextResponse.json({ url });

    } catch (error) {
        console.error('[UPLOAD ERROR]', error);
        return NextResponse.json({ error: 'Error al procesar la carga' }, { status: 500 });
    }
}
