export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { reconcileEvidence } from '@/lib/evidence/reconciliation';
import type { ReconciliationInput } from '@/lib/evidence/reconciliation';

async function handlePost(request: Request) {
  try {
    const body = await request.json();
    const {
      fragments = [],
      facts = [],
      candidateLinks = [],
      methodCode,
      methodVersion,
      projectId,
    } = body;

    if (!projectId || !methodCode || !methodVersion) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, methodCode, methodVersion' },
        { status: 400 },
      );
    }

    const input: ReconciliationInput = {
      fragments,
      facts,
      candidateLinks,
      methodCode,
      methodVersion,
      projectId,
    };

    const run = await reconcileEvidence(input);

    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = handlePost;
