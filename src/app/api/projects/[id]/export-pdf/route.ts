import { NextResponse } from 'next/server';
import type { Project, RuleReview, ProjectCoverage } from '@/lib/projects/types';

export const runtime = 'nodejs';

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function statusBadge(s: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    'verified': { bg: '#dcfce7', text: '#166534' },
    'gap': { bg: '#fee2e2', text: '#991b1b' },
    'not-started': { bg: '#f1f5f9', text: '#64748b' },
    'in-progress': { bg: '#fef3c7', text: '#92400e' },
    'not-applicable': { bg: '#f8fafc', text: '#cbd5e1' },
  };
  const c = colors[s] || colors['not-started'];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;background:${c.bg};color:${c.text}">${s}</span>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;
    if (!project || !project.reviews?.length) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 });
    }

    const coverage = getCoverage(project.reviews);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const filename = `verification-pack-${project.methodCode}-${project.id.slice(0, 8)}.html`;

    const grouped = project.reviews.reduce((acc, r) => {
      if (!acc[r.sectionId]) acc[r.sectionId] = [];
      acc[r.sectionId].push(r);
      return acc;
    }, {} as Record<string, RuleReview[]>);

    const sections = Object.entries(grouped).map(([sec, reviews]) => {
      const rows = reviews.map(r => `
        <tr>
          <td style="padding:10px 12px;font-size:12px;font-family:'SF Mono',Monaco,monospace;color:#64748b;white-space:nowrap">${h(r.ruleId)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#1e293b">${h(r.ruleTitle)}</td>
          <td style="padding:10px 12px;text-align:right">${statusBadge(r.status)}</td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom:32px">
          <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px;letter-spacing:.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">${h(sec)}</h2>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid #e2e8f0">
                <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Rule</th>
                <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Title</th>
                <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
    const gapRows = gaps.map(r => `
      <tr>
        <td style="padding:8px 12px;font-size:11px;color:#991b1b;font-weight:600">${h(r.ruleId)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#1e293b">${h(r.ruleTitle)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#64748b">${h(r.sectionId)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Verification Pack — ${h(project.name)}</title>
<style>
  @media print {
    @page { size: A4; margin: 48px 56px; }
    .page-break { page-break-before: always; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; padding: 48px 56px; line-height: 1.5; }
</style>
</head>
<body>

<!-- COVER -->
<div style="display:flex;flex-direction:column;justify-content:center;min-height:80vh;text-align:center">
  <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px">Verification Pack</div>
  <h1 style="font-size:36px;font-weight:700;color:#0f172a;margin:0 0 12px;letter-spacing:-.5px">${h(project.name)}</h1>
  <div style="font-size:16px;color:#64748b;margin-bottom:24px">${h(project.methodCode)} <span style="color:#cbd5e1">@</span> ${h(project.methodVersion)}</div>
  ${project.aoiLabel ? `<div style="font-size:13px;color:#94a3b8;margin-bottom:8px">AOI: ${h(project.aoiLabel)}</div>` : ''}
  <div style="margin-top:32px">
    <span style="display:inline-block;padding:6px 16px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:#dcfce7;color:#166534">${h(project.status)}</span>
  </div>
  <div style="font-size:11px;color:#cbd5e1;margin-top:48px">Generated ${now}</div>
</div>

<!-- COVERAGE -->
<div class="page-break">
  <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 24px;letter-spacing:.5px;text-transform:uppercase">Coverage</h2>
  <div style="display:flex;gap:16px;margin-bottom:24px">
    ${[
      { label: 'Verified', value: coverage.verified, color: '#16a34a' },
      { label: 'Gaps', value: coverage.gap, color: '#dc2626' },
      { label: 'In Progress', value: coverage.inProgress, color: '#f59e0b' },
      { label: 'Pending', value: coverage.notStarted, color: '#94a3b8' },
      { label: 'N/A', value: coverage.notApplicable, color: '#cbd5e1' },
    ].map(s => `
      <div style="flex:1;text-align:center;padding:20px 12px;border:1px solid #e2e8f0;border-radius:8px">
        <div style="font-size:28px;font-weight:700;color:${s.color}">${s.value}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${s.label}</div>
      </div>
    `).join('')}
  </div>
  <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">
    <div style="height:100%;width:${coverage.percentComplete}%;background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:3px"></div>
  </div>
  <div style="text-align:right;font-size:11px;color:#94a3b8;margin-top:8px;font-weight:600">${coverage.percentComplete}% reviewed</div>
</div>

<!-- MATRIX -->
<div class="page-break">
  <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 24px;letter-spacing:.5px;text-transform:uppercase">Requirement Coverage</h2>
  ${sections}
</div>

${gaps.length > 0 ? `<!-- GAPS -->
<div class="page-break">
  <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 8px;letter-spacing:.5px;text-transform:uppercase">Open Gaps</h2>
  <p style="font-size:12px;color:#94a3b8;margin-bottom:16px">${gaps.length} rule${gaps.length > 1 ? 's' : ''} marked gap or not-started</p>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid #fee2e2">
        <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:.5px">Rule</th>
        <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Title</th>
        <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Section</th>
      </tr>
    </thead>
    <tbody>${gapRows}</tbody>
  </table>
</div>` : ''}

<!-- PROVENANCE -->
<div class="page-break">
  <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:.5px;text-transform:uppercase">Provenance</h2>
  <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    ${[
      ['Project ID', project.id],
      ['Methodology', `${project.methodCode} @ ${project.methodVersion}`],
      ['Created', project.createdAt],
      ['Status', project.status],
      ['Export', now],
      ['Rules Reviewed', `${coverage.verified + coverage.gap} / ${coverage.total}`],
    ].map(([label, value]) => `
      <div style="display:flex;border-bottom:1px solid #f1f5f9;padding:0">
        <div style="flex:0 0 140px;padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc">${label}</div>
        <div style="flex:1;padding:10px 16px;font-size:12px;color:#1e293b">${value}</div>
      </div>
    `).join('')}
  </div>
  <div style="margin-top:48px;text-align:center;font-size:10px;color:#cbd5e1;letter-spacing:.5px">
    Verification pack generated by app.article6 — not a formal certification opinion
  </div>
</div>

</body></html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Export failed', detail: String(err) }, { status: 500 });
  }
}
