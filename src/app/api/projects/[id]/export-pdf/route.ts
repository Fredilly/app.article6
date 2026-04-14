import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Project, ProjectCoverage, RuleReview } from '@/lib/projects/types';

export const runtime = 'nodejs';

function buildHtml(project: Project, coverage: ProjectCoverage): string {
  const now = new Date().toISOString();
  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  const statusColor = (s: string) => {
    if (s === 'verified') return '#16a34a';
    if (s === 'gap') return '#dc2626';
    if (s === 'not-applicable') return '#94a3b8';
    if (s === 'in-progress') return '#f59e0b';
    return '#64748b';
  };

  const rows = Object.entries(grouped)
    .map(([_sectionId, reviews]) =>
      reviews
        .map(
          r => `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.ruleId}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${esc(r.ruleTitle)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:${statusColor(r.status)};font-weight:600">${r.status}</td>
          </tr>`
        )
        .join('')
    )
    .join('');

  const gaps = project.reviews
    .filter(r => r.status === 'gap' || r.status === 'not-started')
    .map(
      r => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-size:11px;color:${statusColor(r.status)}">${r.status}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-size:11px">${esc(r.ruleTitle)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-size:11px">${r.sectionId}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Helvetica,Arial,sans-serif;margin:40px;color:#1e293b}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:16px;margin:28px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th{background:#f1f5f9;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  .meta{font-size:12px;color:#64748b;margin:2px 0}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
  .badge-locked{background:#dbeafe;color:#2563eb}
  .badge-inprogress{background:#fef3c7;color:#d97706}
  .cover{text-align:center;padding:80px 0}
  .cover h1{font-size:28px}
  .stats{display:flex;gap:16px;margin:12px 0}
  .stat{text-align:center;padding:12px 20px;border:1px solid #e2e8f0;border-radius:8px}
  .stat-val{font-size:24px;font-weight:700}
  .stat-label{font-size:11px;color:#64748b}
</style></head>
<body>

<div class="cover">
  <h1>${esc(project.name)}</h1>
  <p class="meta">${esc(project.methodCode)} @ ${esc(project.methodVersion)}</p>
  ${project.aoiLabel ? `<p class="meta">AOI: ${esc(project.aoiLabel)}</p>` : ''}
  <p class="meta">Generated: ${now}</p>
  <p><span class="badge ${project.status === 'locked' ? 'badge-locked' : 'badge-inprogress'}">${project.status.toUpperCase()}</span></p>
</div>

<div style="page-break-before:always">
<h2>Coverage Summary</h2>
<div class="stats">
  <div class="stat"><div class="stat-val" style="color:#16a34a">${coverage.verified}</div><div class="stat-label">Verified</div></div>
  <div class="stat"><div class="stat-val" style="color:#dc2626">${coverage.gap}</div><div class="stat-label">Gaps</div></div>
  <div class="stat"><div class="stat-val" style="color:#f59e0b">${coverage.inProgress}</div><div class="stat-label">In Progress</div></div>
  <div class="stat"><div class="stat-val">${coverage.notStarted}</div><div class="stat-label">Pending</div></div>
  <div class="stat"><div class="stat-val" style="color:#94a3b8">${coverage.notApplicable}</div><div class="stat-label">N/A</div></div>
</div>
<p style="font-size:12px"><strong>${coverage.percentComplete}%</strong> of actionable rules reviewed</p>
</div>

<div style="page-break-before:always">
<h2>Requirement Coverage Matrix</h2>
<table>
  <tr><th>Rule ID</th><th>Title</th><th>Status</th></tr>
  ${rows}
</table>
</div>

${gaps ? `<div style="page-break-before:always">
<h2>Gap Summary</h2>
<p style="font-size:11px;color:#64748b">Rules marked as gap or not-started</p>
<table>
  <tr><th>Status</th><th>Rule</th><th>Section</th></tr>
  ${gaps}
</table>
</div>` : ''}

<div style="page-break-before:always">
<h2>Provenance</h2>
<table>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Project ID</td><td style="padding:6px 8px;font-size:11px">${project.id}</td></tr>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Methodology</td><td style="padding:6px 8px;font-size:11px">${esc(project.methodCode)} @ ${esc(project.methodVersion)}</td></tr>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Created</td><td style="padding:6px 8px;font-size:11px">${project.createdAt}</td></tr>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Status</td><td style="padding:6px 8px;font-size:11px">${project.status}</td></tr>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Export Time</td><td style="padding:6px 8px;font-size:11px">${now}</td></tr>
  <tr><td style="padding:6px 8px;font-size:11px;font-weight:600">Rules Reviewed</td><td style="padding:6px 8px;font-size:11px">${coverage.verified + coverage.gap} / ${coverage.total}</td></tr>
</table>
</div>

</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCoverage(reviews: RuleReview[]): ProjectCoverage {
  const total = reviews.length;
  const verified = reviews.filter(r => r.status === 'verified').length;
  const gap = reviews.filter(r => r.status === 'gap').length;
  const notStarted = reviews.filter(r => r.status === 'not-started').length;
  const notApplicable = reviews.filter(r => r.status === 'not-applicable').length;
  const inProgress = reviews.filter(r => r.status === 'in-progress').length;
  const actionable = total - notApplicable;
  const percentComplete = actionable > 0 ? Math.round(((verified + gap) / actionable) * 100) : 0;
  return { total, verified, gap, notStarted, notApplicable, inProgress, percentComplete };
}

function wkhtmltopdf(htmlPath: string, pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('wkhtmltopdf', ['--quiet', '--encoding', 'utf-8', htmlPath, pdfPath], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;

    if (!project || !project.reviews?.length) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 });
    }

    const coverage = getCoverage(project.reviews);
    const html = buildHtml(project, coverage);
    const tmpDir = tmpdir();
    const htmlPath = join(tmpDir, `pack-${project.id}.html`);
    const pdfPath = join(tmpDir, `pack-${project.id}.pdf`);

    await writeFile(htmlPath, html, 'utf8');
    await wkhtmltopdf(htmlPath, pdfPath);

    const { readFile } = await import('node:fs/promises');
    const pdf = await readFile(pdfPath);

    await unlink(htmlPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});

    const filename = `verification-pack-${project.methodCode}-${project.id.slice(0, 8)}.pdf`;
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'PDF generation failed', detail: String(err) }, { status: 500 });
  }
}
