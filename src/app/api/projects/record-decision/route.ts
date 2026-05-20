export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createDecision, updateDecision, buildDecisionRun } from '@/lib/evidence/decisions';
import type { DecisionInput } from '@/lib/evidence/decisions';

async function handlePost(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      projectId,
      decision: decisionInput,
      existingDecisions,
      reconciliationRunId,
    } = body;

    if (!projectId || !decisionInput) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, decision' },
        { status: 400 },
      );
    }

    if (!action || (action !== 'create' && action !== 'update')) {
      return NextResponse.json(
        { error: 'action must be "create" or "update"' },
        { status: 400 },
      );
    }

    let result;
    if (action === 'create') {
      result = await createDecision(decisionInput as DecisionInput, existingDecisions);
    } else {
      if (!body.existingDecision) {
        return NextResponse.json(
          { error: 'existingDecision required for update action' },
          { status: 400 },
        );
      }
      result = await updateDecision(body.existingDecision, decisionInput as Partial<DecisionInput>);
    }

    const allDecisions = [
      ...(existingDecisions ?? []).filter(
        (d: { decisionId: string }) => d.decisionId !== result.decision.decisionId,
      ),
      result.decision,
    ];

    const run = await buildDecisionRun(projectId, allDecisions, reconciliationRunId);

    return NextResponse.json({
      decision: result.decision,
      warnings: result.warnings,
      run,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = handlePost;
