export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { runExtraction } from '@/lib/evidence/extraction/pipeline';
import type { SourceDocument } from '@/lib/evidence/extraction/types';

async function handlePost(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const filename = decodeURIComponent(request.headers.get('x-article6-filename') ?? 'unknown');
    const projectId = request.headers.get('x-project-id') ?? '';
    const methodCode = request.headers.get('x-method-code') ?? '';
    const methodVersion = request.headers.get('x-method-version') ?? '';

    if (!projectId || !methodCode || !methodVersion) {
      return NextResponse.json(
        { error: 'Missing x-project-id, x-method-code, or x-method-version headers' },
        { status: 400 },
      );
    }

    const buffer = await request.arrayBuffer();
    const contentSha256 = await import('@/lib/proof/hash').then((m) =>
      m.sha256ArrayBuffer(buffer),
    );

    const doc: SourceDocument = {
      id: `doc_${Date.now()}`,
      fileName: filename,
      mime: contentType,
      kind: filename.toLowerCase().endsWith('.pdf') ? 'pdd' : 'workbook',
      sizeBytes: buffer.byteLength,
      contentSha256,
    };

    const run = await runExtraction({
      projectId,
      documents: [{ doc, buffer }],
      methodCode,
      methodVersion,
    });

    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = handlePost;
