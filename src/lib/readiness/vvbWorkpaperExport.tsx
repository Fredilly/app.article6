import { zipSync } from "fflate";
import { canonicalStringify, sha256Hex } from "@/integrity/artifacts";
import type { VvbWorkpaperReport } from "@/lib/readiness/vvbWorkpaperReport";

export type VvbWorkpaperAppendixArtifact = {
  kind: "article6.vvb_workpaper_appendix";
  version: 1;
  reportId: string;
  generatedAt: string;
  methodology: {
    code: string;
    version: string;
    name: string;
    sector: string;
  };
  bundleReferences: VvbWorkpaperReport["evidenceProvenanceReferences"]["bundleReferences"];
  traceability: {
    ruleCount: number;
    evidenceReferenceCount: number;
    rules: Array<{
      ruleId: string;
      reviewStatus: string;
      readinessState: string;
      severity: string;
      linkedEvidenceRefs: string[];
      candidateEvidenceRefs: string[];
      reviewerArtifactState: string;
    }>;
  };
  limitations: string[];
  nonClaims: string[];
};

export type VvbWorkpaperExportManifest = {
  kind: "article6.vvb_workpaper_export";
  version: 1;
  generated_at: string;
  report_id: string;
  files: Array<{
    path: string;
    sha256: string;
    bytes: number;
  }>;
};

export type BuildVvbWorkpaperExportInput = {
  report: VvbWorkpaperReport;
};

export type VvbWorkpaperExportResult = {
  zipBytes: Buffer;
  manifest: VvbWorkpaperExportManifest;
  appendix: VvbWorkpaperAppendixArtifact;
  html: string;
};

const FORBIDDEN_CLAIMS = [
  "verification opinion",
  "formal verification opinion",
  "formal validation opinion",
  "registry approval",
  "registry approved",
  "credit issuance",
  "credit eligibility",
  "verified credits",
  "assurance opinion",
  "vvb approval",
] as const;

const SAFE_NON_CLAIM_SENTENCE = /\b(?:not|no|without|does not|doesn't|avoid|avoids|avoiding|prevent|prevents|preventing)\b/;

function flattenForCanonicalJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isoForZip(iso: string): Date {
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return new Date("1980-01-01T00:00:00.000Z");
  if (parsed.getUTCFullYear() < 1980) return new Date("1980-01-01T00:00:00.000Z");
  if (parsed.getUTCFullYear() > 2099) return new Date("2099-12-31T23:59:58.000Z");
  return parsed;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listOrFallback(items: string[], fallback: string): string {
  if (!items.length) return `<p>${escapeHtml(fallback)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function joinOrFallback(items: string[], fallback: string): string {
  return items.length ? items.map(escapeHtml).join(", ") : escapeHtml(fallback);
}

function buildVvbWorkpaperAppendixArtifact(input: BuildVvbWorkpaperExportInput): VvbWorkpaperAppendixArtifact {
  const report = input.report;
  return {
    kind: "article6.vvb_workpaper_appendix",
    version: 1,
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    methodology: {
      code: report.projectMethodVersionContext.methodologyCode,
      version: report.projectMethodVersionContext.methodologyVersion,
      name: report.projectMethodVersionContext.methodologyName,
      sector: report.projectMethodVersionContext.sector,
    },
    bundleReferences: report.evidenceProvenanceReferences.bundleReferences,
    traceability: {
      ruleCount: report.ruleReviewWorkpaperTable.length,
      evidenceReferenceCount: report.evidenceProvenanceReferences.evidenceReferenceIndex.length,
      rules: report.ruleReviewWorkpaperTable.map((row) => {
        const readiness = report.readinessGapStatus.find((item) => item.ruleId === row.ruleId);
        const artifact = report.reviewerArtifactState.find((item) => item.ruleId === row.ruleId);
        return {
          ruleId: row.ruleId,
          reviewStatus: row.reviewStatus,
          readinessState: readiness?.readinessState ?? "not_available",
          severity: readiness?.severity ?? "not_available",
          linkedEvidenceRefs: row.linkedEvidenceRefs,
          candidateEvidenceRefs: row.candidateEvidenceRefs,
          reviewerArtifactState: artifact?.state ?? "missing",
        };
      }),
    },
    limitations: report.limitationsAndNonClaims.limitations,
    nonClaims: report.limitationsAndNonClaims.nonClaims,
  };
}

function renderRuleReviewRows(report: VvbWorkpaperReport): string {
  return report.ruleReviewWorkpaperTable
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.ruleId)}</strong><br /><span>${escapeHtml(row.ruleTitle)}</span></td>
          <td>${escapeHtml(row.reviewStatusLabel)}</td>
          <td>${escapeHtml(row.reviewRecordScopeLabel)}</td>
          <td>${escapeHtml(row.reviewerRationale)}</td>
          <td>${escapeHtml(row.supportReference)}</td>
          <td>${joinOrFallback(row.linkedEvidenceRefs, "No linked evidence refs")}</td>
          <td>${joinOrFallback(row.candidateEvidenceRefs, "No candidate evidence refs")}</td>
          <td>${joinOrFallback(row.attachmentRefs, "No attachment refs")}</td>
        </tr>`,
    )
    .join("");
}

function renderReadinessRows(report: VvbWorkpaperReport): string {
  return report.readinessGapStatus
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.ruleId)}</strong><br /><span>${escapeHtml(row.ruleTitle)}</span></td>
          <td>${escapeHtml(row.readinessState.replaceAll("_", " "))}</td>
          <td>${escapeHtml(row.severity)}</td>
          <td>${joinOrFallback(row.expectedEvidence, "No encoded expectation")}</td>
          <td>${joinOrFallback(row.missingEvidence, "No missing evidence listed")}</td>
          <td>${joinOrFallback(row.nextActions, "No next action listed")}</td>
        </tr>`,
    )
    .join("");
}

function renderArtifactRows(report: VvbWorkpaperReport): string {
  return report.reviewerArtifactState
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.ruleId)}</strong><br /><span>${escapeHtml(row.ruleTitle)}</span></td>
          <td>${escapeHtml(row.state)}</td>
          <td>${escapeHtml(row.savedAt)}</td>
          <td>${escapeHtml(row.note)}</td>
        </tr>`,
    )
    .join("");
}

function renderEvidenceRows(report: VvbWorkpaperReport): string {
  return report.evidenceProvenanceReferences.evidenceReferenceIndex
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.id)}</strong><br /><span>${escapeHtml(row.label)}</span></td>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.referenceState.replaceAll("_", " "))}</td>
          <td>${joinOrFallback(row.linkedRuleIds, "No linked rules")}</td>
          <td>${escapeHtml(row.note)}</td>
        </tr>`,
    )
    .join("");
}

function reportHtmlDocument(report: VvbWorkpaperReport): string {
  const context = report.projectMethodVersionContext;
  const totals = report.executiveSummary.totals;
  const body = `
    <article>
      <section>
        <p><strong>VVB draft workpaper support</strong> · <strong>Draft export only</strong></p>
        <h1>${escapeHtml(context.projectName)}</h1>
        <p>${escapeHtml(context.methodologyCode)}@${escapeHtml(context.methodologyVersion)} · ${escapeHtml(report.workpaperStatus.label)}</p>
        <p>${escapeHtml(report.executiveSummary.headline)}</p>
        <p>${escapeHtml(report.workpaperStatus.note)}</p>
        <dl>
          <dt>Source run scope</dt><dd>${escapeHtml(report.workpaperStatus.sourceRunScope.replaceAll("_", " "))}</dd>
          <dt>Review record scope</dt><dd>${escapeHtml(report.workpaperStatus.reviewRecordScope.replaceAll("_", " "))}</dd>
          <dt>Project ID</dt><dd>${escapeHtml(context.projectId)}</dd>
          <dt>Proponent</dt><dd>${escapeHtml(context.proponent)}</dd>
          <dt>Region</dt><dd>${escapeHtml(context.region)}</dd>
          <dt>Methodology</dt><dd>${escapeHtml(context.methodologyCode)}@${escapeHtml(context.methodologyVersion)}</dd>
          <dt>Generated</dt><dd>${escapeHtml(report.generatedAt)}</dd>
          <dt>Report ID</dt><dd>${escapeHtml(report.reportId)}</dd>
        </dl>
      </section>

      <section>
        <h2>Project / method / version context</h2>
        <p><strong>Methodology name:</strong> ${escapeHtml(context.methodologyName)}</p>
        <p><strong>Sector:</strong> ${escapeHtml(context.sector)}</p>
        <p><strong>Description:</strong> ${escapeHtml(context.projectDescription)}</p>
      </section>

      <section>
        <h2>Registry and program context</h2>
        <p><strong>Registry program:</strong> ${escapeHtml(report.registryAndProgramContext.registryProgram)}</p>
        <p><strong>Registry project ID:</strong> ${escapeHtml(report.registryAndProgramContext.registryProjectId)}</p>
        <p>${escapeHtml(report.registryAndProgramContext.note)}</p>
      </section>

      <section>
        <h2>Executive Summary</h2>
        <ul>
          <li>Total rules: ${totals.rules}</li>
          <li>Reviewed rules: ${totals.reviewed}</li>
          <li>Pending or not reviewed: ${totals.pendingOrNotReviewed}</li>
          <li>Needs follow-up: ${totals.needsFollowup}</li>
          <li>Missing evidence / not started: ${totals.missingEvidence}</li>
          <li>Unknown expectation: ${totals.unknownExpectation}</li>
          <li>Saved reviewer artifact state: ${totals.reviewerArtifactSaved}</li>
        </ul>
        <p>${escapeHtml(report.executiveSummary.note)}</p>
      </section>

      <section>
        <h2>Rule review workpaper table</h2>
        <p>Rows remain draft workpaper support unless a reviewer has explicitly recorded a non-pending judgment. Review rows are workspace-level method/version records unless separately saved as run-bound reviewer artifact state.</p>
        <table>
          <thead>
            <tr><th>Rule</th><th>Review status</th><th>Record scope</th><th>Reviewer rationale</th><th>Support reference</th><th>Linked evidence refs</th><th>Candidate evidence refs</th><th>Attachment refs</th></tr>
          </thead>
          <tbody>${renderRuleReviewRows(report)}</tbody>
        </table>
      </section>

      <section>
        <h2>Readiness / gap status</h2>
        <table>
          <thead>
            <tr><th>Rule</th><th>Readiness state</th><th>Severity</th><th>Expected evidence</th><th>Missing evidence</th><th>Next actions</th></tr>
          </thead>
          <tbody>${renderReadinessRows(report)}</tbody>
        </table>
      </section>

      <section>
        <h2>Reviewer artifact state</h2>
        <table>
          <thead>
            <tr><th>Rule</th><th>State</th><th>Saved at</th><th>Note</th></tr>
          </thead>
          <tbody>${renderArtifactRows(report)}</tbody>
        </table>
      </section>

      <section>
        <h2>Evidence / provenance references</h2>
        <h3>Supplied documents</h3>
        ${
          report.evidenceProvenanceReferences.suppliedDocuments.length
            ? `<ul>${report.evidenceProvenanceReferences.suppliedDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : "<p>No supplied documents recorded.</p>"
        }
        <h3>Missing documents</h3>
        ${
          report.evidenceProvenanceReferences.missingDocuments.length
            ? `<ul>${report.evidenceProvenanceReferences.missingDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}</li>`)
                .join("")}</ul>`
            : "<p>No missing documents recorded.</p>"
        }
        <h3>Evidence reference index</h3>
        <table>
          <thead>
            <tr><th>Reference</th><th>Type</th><th>Reference state</th><th>Linked rules</th><th>Note</th></tr>
          </thead>
          <tbody>${renderEvidenceRows(report)}</tbody>
        </table>
        <h3>Bundle references</h3>
        <ul>
          ${report.evidenceProvenanceReferences.bundleReferences
            .map((item) => `<li>${escapeHtml(item.label)}: ${escapeHtml(item.value)} (${escapeHtml(item.availability)})</li>`)
            .join("")}
        </ul>
      </section>

      <section>
        <h2>Limitations and non-claims</h2>
        <h3>Limitations</h3>
        ${listOrFallback(report.limitationsAndNonClaims.limitations, "No limitations listed.")}
        <h3>Non-claims</h3>
        ${listOrFallback(report.limitationsAndNonClaims.nonClaims, "No non-claims listed.")}
      </section>

      <section>
        <h2>Technical Appendix</h2>
        <p><strong>Generated:</strong> ${escapeHtml(report.technicalAppendix.generatedAt)}</p>
        <h3>State definitions</h3>
        ${listOrFallback(
          report.technicalAppendix.stateDefinitions.map(
            (item) => `${item.state.replaceAll("_", " ")} · ${item.description}`,
          ),
          "No state definitions listed.",
        )}
      </section>
    </article>`;

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charSet="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(context.projectName)} VVB draft workpaper support</title>`,
    "<style>",
    "body{margin:0;background:#f8fafc;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
    ".report-shell{max-width:1120px;margin:0 auto;padding:24px;}",
    "table{width:100%;border-collapse:collapse;margin-top:12px;}",
    "th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;text-align:left;font-size:12px;}",
    "th{background:#e2e8f0;}",
    "section{margin-bottom:24px;}",
    "</style>",
    "</head>",
    "<body>",
    `<div class="report-shell">${body}</div>`,
    "</body>",
    "</html>",
  ].join("");
}

function assertNoForbiddenClaims(serialized: string): void {
  const haystack = serialized.toLowerCase();
  const found = FORBIDDEN_CLAIMS.find((claim) => {
    let startIndex = 0;
    while (startIndex < haystack.length) {
      const index = haystack.indexOf(claim, startIndex);
      if (index === -1) return false;
      const sentenceStart = Math.max(
        haystack.lastIndexOf(".", index - 1),
        haystack.lastIndexOf("!", index - 1),
        haystack.lastIndexOf("?", index - 1),
        haystack.lastIndexOf("\n", index - 1),
      );
      const sentenceFragment = haystack.slice(Math.max(0, sentenceStart + 1), index);
      const negated = SAFE_NON_CLAIM_SENTENCE.test(sentenceFragment);
      if (!negated) return true;
      startIndex = index + claim.length;
    }
    return false;
  });
  if (found) {
    throw new Error(`VVB workpaper export contains forbidden claim language: ${found}`);
  }
}

export function buildVvbWorkpaperExport(input: BuildVvbWorkpaperExportInput): VvbWorkpaperExportResult {
  const appendix = buildVvbWorkpaperAppendixArtifact(input);
  const reportJson = canonicalStringify(flattenForCanonicalJson(input.report));
  const appendixJson = canonicalStringify(flattenForCanonicalJson(appendix));
  const evidenceIndexJson = canonicalStringify(
    flattenForCanonicalJson(input.report.evidenceProvenanceReferences.evidenceReferenceIndex),
  );
  const html = reportHtmlDocument(input.report);

  assertNoForbiddenClaims([reportJson, appendixJson, evidenceIndexJson, html].join("\n"));

  const fileEntries = [
    {
      path: "vvb-draft-workpaper/workpaper.json",
      bytes: Buffer.from(reportJson, "utf8"),
    },
    {
      path: "vvb-draft-workpaper/workpaper.html",
      bytes: Buffer.from(html, "utf8"),
    },
    {
      path: "vvb-draft-workpaper/appendix/workpaper-traceability.json",
      bytes: Buffer.from(appendixJson, "utf8"),
    },
    {
      path: "vvb-draft-workpaper/appendix/evidence-reference-index.json",
      bytes: Buffer.from(evidenceIndexJson, "utf8"),
    },
  ].sort((a, b) => a.path.localeCompare(b.path));

  const manifest: VvbWorkpaperExportManifest = {
    kind: "article6.vvb_workpaper_export",
    version: 1,
    generated_at: input.report.generatedAt,
    report_id: input.report.reportId,
    files: fileEntries.map((entry) => ({
      path: entry.path,
      sha256: sha256Hex(entry.bytes),
      bytes: entry.bytes.length,
    })),
  };

  const manifestBytes = Buffer.from(canonicalStringify(flattenForCanonicalJson(manifest)), "utf8");
  const mtime = isoForZip(input.report.generatedAt);
  const zipEntries: Record<string, Uint8Array | [Uint8Array, { mtime: Date }]> = {
    "manifest.json": [new Uint8Array(manifestBytes), { mtime }],
  };

  for (const entry of fileEntries) {
    zipEntries[entry.path] = [new Uint8Array(entry.bytes), { mtime }];
  }

  return {
    zipBytes: Buffer.from(zipSync(zipEntries, { level: 0 })),
    manifest,
    appendix,
    html,
  };
}
