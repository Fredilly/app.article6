import { zipSync } from "fflate";
import { canonicalStringify, sha256Hex } from "@/integrity/artifacts";
import {
  escapeHtml,
  joinEscaped,
  renderList,
  renderMetricCard,
  renderReportHtmlDocument,
} from "@/lib/readiness/reportHtmlTheme";
import { buildExportConventions } from "@/lib/export/conventions";
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
  export_conventions: ReturnType<typeof buildExportConventions>;
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

function joinOrFallback(items: string[], fallback: string): string {
  return joinEscaped(items, fallback);
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
          <td><span class="cell-title">${escapeHtml(row.ruleId)}</span><span class="cell-subtitle">${escapeHtml(row.ruleTitle)}</span></td>
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
          <td><span class="cell-title">${escapeHtml(row.ruleId)}</span><span class="cell-subtitle">${escapeHtml(row.ruleTitle)}</span></td>
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
          <td><span class="cell-title">${escapeHtml(row.ruleId)}</span><span class="cell-subtitle">${escapeHtml(row.ruleTitle)}</span></td>
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
          <td><span class="cell-title">${escapeHtml(row.id)}</span><span class="cell-subtitle">${escapeHtml(row.label)}</span></td>
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
  const executiveCards = [
    renderMetricCard("Reviewed rules", String(totals.reviewed), `${totals.rules} total`),
    renderMetricCard("Pending or not reviewed", String(totals.pendingOrNotReviewed)),
    renderMetricCard("Missing evidence", String(totals.missingEvidence), `${totals.unknownExpectation} unknown expectation`),
    renderMetricCard("Reviewer artifact saved", String(totals.reviewerArtifactSaved), `${totals.needsFollowup} follow-up item${totals.needsFollowup === 1 ? "" : "s"}`),
  ].join("");
  const body = `
      <section class="report-section">
        <div class="section-kicker">Project context</div>
        <h2 class="section-title">Project, method, and run context</h2>
        <div class="section-body">
          <p><strong>Methodology name:</strong> ${escapeHtml(context.methodologyName)}</p>
          <p><strong>Sector:</strong> ${escapeHtml(context.sector)}</p>
          <p><strong>Description:</strong> ${escapeHtml(context.projectDescription)}</p>
          <div class="pill-row">
            <span class="pill">Source run scope: ${escapeHtml(report.workpaperStatus.sourceRunScope.replaceAll("_", " "))}</span>
            <span class="pill">Review record scope: ${escapeHtml(report.workpaperStatus.reviewRecordScope.replaceAll("_", " "))}</span>
            <span class="pill">${escapeHtml(report.workpaperStatus.label)}</span>
          </div>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Registry context</div>
        <h2 class="section-title">Registry and program context</h2>
        <div class="section-body">
          <p><strong>Registry program:</strong> ${escapeHtml(report.registryAndProgramContext.registryProgram)}</p>
          <p><strong>Registry project ID:</strong> ${escapeHtml(report.registryAndProgramContext.registryProjectId)}</p>
          <p>${escapeHtml(report.registryAndProgramContext.note)}</p>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Executive summary</div>
        <h2 class="section-title">Draft workpaper status</h2>
        <div class="section-body">
          <p>${escapeHtml(report.executiveSummary.note)}</p>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Workpaper table</div>
        <h2 class="section-title">Rule review workpaper table</h2>
        <div class="section-body">
        <p>Rows remain draft workpaper support unless a reviewer has explicitly recorded a non-pending judgment. Review rows are workspace-level method/version records unless separately saved as run-bound reviewer artifact state.</p>
        <table class="report-table">
          <thead>
            <tr><th>Rule</th><th>Review status</th><th>Record scope</th><th>Reviewer rationale</th><th>Support reference</th><th>Linked evidence refs</th><th>Candidate evidence refs</th><th>Attachment refs</th></tr>
          </thead>
          <tbody>${renderRuleReviewRows(report)}</tbody>
        </table>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Readiness</div>
        <h2 class="section-title">Readiness and gap status</h2>
        <div class="section-body">
        <table class="report-table">
          <thead>
            <tr><th>Rule</th><th>Readiness state</th><th>Severity</th><th>Expected evidence</th><th>Missing evidence</th><th>Next actions</th></tr>
          </thead>
          <tbody>${renderReadinessRows(report)}</tbody>
        </table>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Reviewer record</div>
        <h2 class="section-title">Reviewer artifact state</h2>
        <div class="section-body">
        <table class="report-table">
          <thead>
            <tr><th>Rule</th><th>State</th><th>Saved at</th><th>Note</th></tr>
          </thead>
          <tbody>${renderArtifactRows(report)}</tbody>
        </table>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Traceability</div>
        <h2 class="section-title">Evidence and provenance references</h2>
        <div class="section-body">
        <h3 class="subsection-title">Supplied documents</h3>
        ${
          report.evidenceProvenanceReferences.suppliedDocuments.length
            ? `<ul>${report.evidenceProvenanceReferences.suppliedDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No supplied documents recorded.</p>'
        }
        <h3 class="subsection-title">Missing documents</h3>
        ${
          report.evidenceProvenanceReferences.missingDocuments.length
            ? `<ul>${report.evidenceProvenanceReferences.missingDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No missing documents recorded.</p>'
        }
        <h3 class="subsection-title">Evidence reference index</h3>
        <table class="report-table">
          <thead>
            <tr><th>Reference</th><th>Type</th><th>Reference state</th><th>Linked rules</th><th>Note</th></tr>
          </thead>
          <tbody>${renderEvidenceRows(report)}</tbody>
        </table>
        <h3 class="subsection-title">Bundle references</h3>
        <ul>
          ${report.evidenceProvenanceReferences.bundleReferences
            .map((item) => `<li>${escapeHtml(item.label)}: ${escapeHtml(item.value)} (${escapeHtml(item.availability)})</li>`)
            .join("")}
        </ul>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Limits</div>
        <h2 class="section-title">Limitations and non-claims</h2>
        <div class="section-body">
        <h3 class="subsection-title">Limitations</h3>
        ${renderList(report.limitationsAndNonClaims.limitations, "No limitations listed.")}
        <h3 class="subsection-title">Non-claims</h3>
        ${renderList(report.limitationsAndNonClaims.nonClaims, "No non-claims listed.")}
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Appendix</div>
        <h2 class="section-title">Technical appendix</h2>
        <div class="section-body">
        <p><strong>Generated:</strong> ${escapeHtml(report.technicalAppendix.generatedAt)}</p>
        <h3 class="subsection-title">State definitions</h3>
        ${renderList(
          report.technicalAppendix.stateDefinitions.map(
            (item) => `${item.state.replaceAll("_", " ")} · ${item.description}`,
          ),
          "No state definitions listed.",
        )}
        </div>
      </section>`;

  return renderReportHtmlDocument({
    title: report.executiveSummary.headline,
    reportType: "VVB Draft Workpaper Export",
    scopeLabel: "Draft workpaper support only",
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    methodologyLabel: `${context.methodologyCode}@${context.methodologyVersion}`,
    contextLabel: report.workpaperStatus.sourceRunId !== "Unavailable" ? `Run ${report.workpaperStatus.sourceRunId}` : context.projectName,
    bannerTitle: "Support-only scope notice",
    bannerBody:
      "This Article6 export is draft VVB workpaper support only. It preserves readiness and review traceability but does not express verifier authority, registry acceptance, or issuance outcomes.",
    heroSummary: `Article6 ${context.projectName} VVB draft workpaper support`,
    executiveCards,
    body,
    footerNote: "Support-only export. Article6 does not provide a formal verification or approval decision in this workpaper.",
  });
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
    export_conventions: buildExportConventions("vvb_workpaper"),
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
