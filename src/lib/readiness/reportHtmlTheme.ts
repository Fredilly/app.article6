export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function joinEscaped(values: string[], fallback: string): string {
  return values.length ? values.map(escapeHtml).join(", ") : escapeHtml(fallback);
}

export function renderList(items: string[], empty: string): string {
  if (!items.length) return `<p class="empty-note">${escapeHtml(empty)}</p>`;
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderMetricCard(label: string, value: string, note?: string): string {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      ${note ? `<div class="metric-note">${escapeHtml(note)}</div>` : ""}
    </div>`;
}

export function renderKeyValueGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <dl class="meta-grid">
      ${items
        .map(
          (item) => `
            <div class="meta-item">
              <dt>${escapeHtml(item.label)}</dt>
              <dd>${escapeHtml(item.value)}</dd>
            </div>`,
        )
        .join("")}
    </dl>`;
}

export function renderReportHtmlDocument(input: {
  title: string;
  reportType: string;
  scopeLabel: string;
  reportId: string;
  generatedAt: string;
  methodologyLabel: string;
  contextLabel?: string;
  bannerTitle: string;
  bannerBody: string;
  heroSummary: string;
  executiveCards: string;
  body: string;
  footerNote: string;
}): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charSet="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(input.title)}</title>`,
    "<style>",
    "body{margin:0;background:#f3f6f8;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
    ".report-shell{max-width:1120px;margin:0 auto;padding:28px 24px 40px;}",
    ".report-page{background:#fff;border:1px solid #dbe3ea;border-radius:28px;box-shadow:0 24px 80px rgba(15,23,42,.08);overflow:hidden;}",
    ".report-header{padding:28px 32px 22px;background:linear-gradient(180deg,#f8fbfc 0%,#ffffff 100%);border-bottom:1px solid #e2e8f0;}",
    ".brand-row{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;flex-wrap:wrap;}",
    ".brand-mark{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#0f172a;}",
    ".brand-dot{width:12px;height:12px;border-radius:999px;background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);box-shadow:0 0 0 6px rgba(37,99,235,.08);}",
    ".scope-chip{display:inline-flex;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;color:#334155;background:#fff;}",
    ".report-title{margin:18px 0 6px;font-size:34px;line-height:1.05;font-weight:700;letter-spacing:-.03em;color:#020617;}",
    ".report-subtitle{margin:0;color:#475569;font-size:15px;line-height:1.6;max-width:820px;}",
    ".meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 0;padding:0;}",
    ".meta-item{padding:14px 16px;border:1px solid #e2e8f0;border-radius:18px;background:#fbfdff;min-width:0;}",
    ".meta-item dt{font-size:11px;line-height:1.3;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 7px;}",
    ".meta-item dd{margin:0;font-size:14px;line-height:1.45;color:#0f172a;word-break:break-word;}",
    ".banner{margin:20px 0 0;padding:16px 18px;border:1px solid #bfdbfe;border-radius:18px;background:linear-gradient(180deg,#eff6ff 0%,#f8fbff 100%);}",
    ".banner-title{margin:0 0 6px;font-size:12px;line-height:1.3;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#1d4ed8;}",
    ".banner-body{margin:0;font-size:14px;line-height:1.6;color:#1e293b;}",
    ".hero-summary{padding:0 32px 26px;font-size:16px;line-height:1.75;color:#334155;}",
    ".executive-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:0 32px 26px;}",
    ".metric-card{padding:16px 18px;border:1px solid #dbe3ea;border-radius:20px;background:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}",
    ".metric-label{font-size:11px;line-height:1.3;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;}",
    ".metric-value{margin-top:10px;font-size:28px;line-height:1;font-weight:700;letter-spacing:-.03em;color:#0f172a;}",
    ".metric-note{margin-top:8px;font-size:12px;line-height:1.5;color:#64748b;}",
    ".report-body{padding:6px 32px 36px;}",
    ".report-section{padding:22px 0;border-top:1px solid #eef2f7;}",
    ".report-section:first-child{border-top:0;padding-top:10px;}",
    ".section-kicker{margin:0 0 6px;font-size:11px;line-height:1.3;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;}",
    ".section-title{margin:0;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em;color:#020617;}",
    ".section-body{margin-top:14px;font-size:14px;line-height:1.75;color:#334155;}",
    ".section-body p{margin:0 0 12px;}",
    ".section-body p:last-child{margin-bottom:0;}",
    ".detail-list{margin:0;padding-left:20px;display:grid;gap:8px;color:#334155;}",
    ".empty-note{margin:0;color:#64748b;font-style:italic;}",
    ".subsection-title{margin:18px 0 8px;font-size:12px;line-height:1.3;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#475569;}",
    ".pill-row{display:flex;flex-wrap:wrap;gap:8px;}",
    ".pill{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;border:1px solid #dbe3ea;background:#f8fafc;font-size:12px;line-height:1.2;font-weight:600;color:#334155;}",
    "table.report-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:14px;border:1px solid #dbe3ea;border-radius:20px;overflow:hidden;background:#fff;}",
    ".report-table thead th{padding:12px 14px;background:#f8fafc;border-bottom:1px solid #dbe3ea;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#475569;text-align:left;vertical-align:top;}",
    ".report-table tbody td{padding:14px;border-bottom:1px solid #eef2f7;font-size:13px;line-height:1.6;color:#1e293b;vertical-align:top;}",
    ".report-table tbody tr:nth-child(even) td{background:#fbfdff;}",
    ".report-table tbody tr:last-child td{border-bottom:0;}",
    ".cell-title{display:block;font-weight:700;color:#020617;}",
    ".cell-subtitle{display:block;margin-top:4px;color:#64748b;}",
    ".report-footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 32px 28px;border-top:1px solid #e2e8f0;background:#fcfdff;color:#64748b;font-size:12px;line-height:1.6;}",
    ".footer-brand{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f172a;}",
    "@media print{body{background:#fff}.report-shell{max-width:none;padding:0}.report-page{box-shadow:none;border:0;border-radius:0}.report-header,.hero-summary,.executive-grid,.report-body,.report-footer{padding-left:20px;padding-right:20px}.banner,.meta-item,.metric-card,.report-table{break-inside:avoid}}",
    "@media (max-width:900px){.meta-grid,.executive-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.report-title{font-size:28px}}",
    "@media (max-width:640px){.report-shell{padding:16px}.report-header,.hero-summary,.executive-grid,.report-body,.report-footer{padding-left:18px;padding-right:18px}.meta-grid,.executive-grid{grid-template-columns:minmax(0,1fr)}.report-title{font-size:24px}}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="report-shell"><div class="report-page">',
    '<header class="report-header">',
    '<div class="brand-row">',
    `<div class="brand-mark"><span class="brand-dot"></span><span>Article6</span></div>`,
    `<div class="scope-chip">${escapeHtml(input.scopeLabel)}</div>`,
    "</div>",
    `<h1 class="report-title">${escapeHtml(input.reportType)}</h1>`,
    `<p class="report-subtitle">${escapeHtml(input.heroSummary)}</p>`,
    renderKeyValueGrid(
      [
        { label: "Report ID", value: input.reportId },
        { label: "Generated", value: input.generatedAt },
        { label: "Methodology", value: input.methodologyLabel },
        { label: "Context", value: input.contextLabel ?? "Article6 export workspace" },
      ],
    ),
    `<div class="banner"><div class="banner-title">${escapeHtml(input.bannerTitle)}</div><p class="banner-body">${escapeHtml(input.bannerBody)}</p></div>`,
    "</header>",
    `<div class="hero-summary">${escapeHtml(input.title)}</div>`,
    `<section class="executive-grid">${input.executiveCards}</section>`,
    `<main class="report-body">${input.body}</main>`,
    `<footer class="report-footer"><div><span class="footer-brand">Article6</span><br />${escapeHtml(input.footerNote)}</div><div>${escapeHtml(input.reportId)}</div></footer>`,
    "</div></div>",
    "</body>",
    "</html>",
  ].join("");
}
