export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { buildPremiumPdf, buildPremiumZip } from '@/lib/evidence/export';
import type { PremiumExportInput } from '@/lib/evidence/export';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { SourceDocument, DocumentFragment, ExtractedFact, CandidateLink } from '@/lib/evidence/extraction/types';
import type { ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type { DecisionRun } from '@/lib/evidence/decisions/types';

async function handlePost(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;
    const format = body.format as string | undefined; // 'pdf' | 'zip' | 'both'

    if (!project) {
      return NextResponse.json({ error: 'Missing project data' }, { status: 400 });
    }

    const coverage = body.coverage as ProjectCoverage | undefined;
    const inventory = (body.inventory ?? []) as EvidenceInventoryItem[];
    const sources = (body.sources ?? []) as SourceDocument[];
    const fragments = (body.fragments ?? []) as DocumentFragment[];
    const facts = (body.facts ?? []) as ExtractedFact[];
    const candidateLinks = (body.candidateLinks ?? []) as CandidateLink[];
    const reconciliationRun = body.reconciliationRun as ReconciliationRun | undefined;
    const decisionRun = body.decisionRun as DecisionRun | undefined;

    const safeCoverage: ProjectCoverage = coverage ?? {
      total: project.reviews.length,
      verified: project.reviews.filter((r) => r.status === 'verified').length,
      gap: project.reviews.filter((r) => r.status === 'gap').length,
      notStarted: project.reviews.filter((r) => r.status === 'not-started').length,
      notApplicable: project.reviews.filter((r) => r.status === 'not-applicable').length,
      inProgress: project.reviews.filter((r) => r.status === 'in-progress').length,
      percentComplete: 0,
    };

    const input: PremiumExportInput = {
      project,
      coverage: safeCoverage,
      inventory,
      sources,
      fragments,
      facts,
      candidateLinks,
      reconciliationRun,
      decisionRun,
      exportTime: body.exportTime,
      pipelineVersion: body.pipelineVersion ?? '1.0.0',
    };

    const fmt = format === 'zip' ? 'zip' : format === 'both' ? 'both' : 'pdf';

    if (fmt === 'pdf') {
      const pdf = buildPremiumPdf(input);
      const filename = `premium-evidence-report-${project.id.slice(0, 8)}.pdf`;
      const ab = new ArrayBuffer(pdf.byteLength);
      new Uint8Array(ab).set(pdf);
      const blob = new Blob([ab], { type: 'application/pdf' });
      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const zip = await buildPremiumZip(input);
    const filename = `premium-evidence-export-${project.id.slice(0, 8)}.zip`;
    const ab = new ArrayBuffer(zip.byteLength);
    new Uint8Array(ab).set(zip);
    const blob = new Blob([ab], { type: 'application/zip' });
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Premium export generation failed', detail: String(err) }, { status: 500 });
  }
}

export const POST = handlePost;
