import { NextResponse } from 'next/server';
import type { Project } from '@/lib/projects/types';
import { buildProjectExportPdf } from '@/lib/projects/exportPdf';
import { getProjectCoverage } from '@/lib/projects/storage';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;
    const hasMethodologyReviews = Array.isArray(project?.reviews) && project.reviews.length > 0;
    const hasManualReview = project?.reviewMode === 'manual';
    if (!project || (!hasMethodologyReviews && !hasManualReview)) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 });
    }

    const coverage = getProjectCoverage(project);
    const pdf = buildProjectExportPdf(project, coverage);
    const filename = project.reviewMode === 'manual'
      ? `manual-review-pack-${project.id.slice(0, 8)}.pdf`
      : `verification-pack-${project.methodCode}-${project.id.slice(0, 8)}.pdf`;
    const ab = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(ab).set(pdf);
    const blob = new Blob([ab], { type: 'application/pdf' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'PDF generation failed', detail: String(err) }, { status: 500 });
  }
}
