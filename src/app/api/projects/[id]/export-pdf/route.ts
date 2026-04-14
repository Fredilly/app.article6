import { NextResponse } from 'next/server';
import type { Project } from '@/lib/projects/types';
import { buildProjectExportPdf, getProjectCoverage } from '@/lib/projects/exportPdf';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;
    if (!project || !project.reviews?.length) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 });
    }

    const coverage = getProjectCoverage(project.reviews);
    const pdf = buildProjectExportPdf(project, coverage);
    const filename = `verification-pack-${project.methodCode}-${project.id.slice(0, 8)}.pdf`;
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
