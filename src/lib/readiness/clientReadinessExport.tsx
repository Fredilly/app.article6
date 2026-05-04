import { zipSync } from "fflate";
import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RequirementCoverageExpectedEvidenceType } from "@/app/m/_lib/requirementCoverage";
import { canonicalStringify, sha256Hex } from "@/integrity/artifacts";
import type { ClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";

export type ClientReadinessAppendixArtifact = {
  kind: "article6.client_readiness_appendix";
  version: 1;
  reportId: string;
  generatedAt: string;
  project: ClientReadinessReport["projectAndMethodologyContext"];
  methodology: {
    code: string;
    version: string;
    name?: string;
    sector?: string;
  };
  limitations: string[];
  traceability: {
    ruleCount: number;
    evidenceCount: number;
    rules: Array<{
      ruleId: string;
      ruleTitle: string;
      state: RuleReadinessGap["state"];
      severity: RuleReadinessGap["severity"];
      baseState: RuleReadinessGap["baseState"];
      baseSeverity: RuleReadinessGap["baseSeverity"];
      missingExpectedEvidence: string[];
      recommendations: string[];
      linkedEvidence: Array<{
        id: string;
        label: string;
        type: string;
        source: string;
      }>;
      override:
        | {
            state: RuleReadinessGap["state"] | null;
            severity: RuleReadinessGap["severity"] | null;
            reason: string;
            reviewer: string | null;
            updatedAt: string | null;
          }
        | null;
    }>;
  };
  evidenceReferenceIndex: ClientReadinessReport["technicalAppendix"]["evidenceReferenceIndex"];
};

export type ClientReadinessExportManifest = {
  kind: "article6.client_readiness_export";
  version: 1;
  generated_at: string;
  report_id: string;
  files: Array<{
    path: string;
    sha256: string;
    bytes: number;
  }>;
};

export type BuildClientReadinessReportExportInput = {
  report: ClientReadinessReport;
  readinessGaps: RuleReadinessGap[];
};

export type ClientReadinessReportExportResult = {
  zipBytes: Buffer;
  manifest: ClientReadinessExportManifest;
  appendix: ClientReadinessAppendixArtifact;
  html: string;
};

const FORBIDDEN_CLAIMS = [
  "verification opinion",
  "registry approval",
  "registry approved",
  "credit issuance",
  "verified credits",
  "assurance opinion",
] as const;

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

function expectedEvidenceLabel(type: RequirementCoverageExpectedEvidenceType): string {
  return EXPECTED_EVIDENCE_LABELS[type] ?? type;
}

function evidenceLabel(item: RuleReadinessGap["linkedEvidence"][number]): string {
  return item.title?.trim() || item.fragmentLabel?.trim() || item.documentLabel?.trim() || item.id;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function joinEscaped(values: string[], fallback: string): string {
  return values.length ? values.map(escapeHtml).join(", ") : escapeHtml(fallback);
}

function renderList(items: string[], empty: string): string {
  if (!items.length) return `<p>${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderRuleRows(report: ClientReadinessReport): string {
  return report.ruleFindingsMatrix
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.ruleId)}</strong><br /><span>${escapeHtml(item.ruleTitle)}</span></td>
          <td>${escapeHtml(item.category.replaceAll("_", " "))}</td>
          <td>${escapeHtml(item.severity)}</td>
          <td>${escapeHtml(item.assessment)}${
            item.missingExpectedEvidence.length
              ? `<br /><span>Missing: ${joinEscaped(item.missingExpectedEvidence, "")}</span>`
              : ""
          }</td>
          <td>${joinEscaped(item.nextActions, "No next action listed yet.")}</td>
        </tr>`,
    )
    .join("");
}

function renderEvidenceChecklistRows(report: ClientReadinessReport): string {
  return report.evidenceChecklist.items
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.ruleId)}</strong><br /><span>${escapeHtml(item.ruleTitle)}</span></td>
          <td>${joinEscaped(item.expectedEvidence, "No encoded expectation listed.")}</td>
          <td>${joinEscaped(item.linkedEvidence, "No linked evidence yet.")}</td>
          <td>${joinEscaped(item.missingEvidence, "No missing evidence listed.")}</td>
          <td>${escapeHtml(item.status.replaceAll("_", " "))}</td>
        </tr>`,
    )
    .join("");
}

function renderOpenFindingsGroup(title: string, description: string, items: ClientReadinessReport["openFindings"]["missingEvidence"]): string {
  return `
    <section>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${
        items.length
          ? `<ul>${items
              .map(
                (item) => `<li><strong>${escapeHtml(item.ruleId)}</strong> ${escapeHtml(item.ruleTitle)} · ${escapeHtml(item.severity)} · ${escapeHtml(item.assessment)} · Next: ${joinEscaped(item.nextActions, "Reviewer follow-up still needs to be defined.")}</li>`,
              )
              .join("")}</ul>`
          : "<p>No items in this group right now.</p>"
      }
    </section>`
}

function reportHtmlDocument(report: ClientReadinessReport): string {
  const context = report.projectAndMethodologyContext;
  const totals = report.executiveReadinessSummary.totals;
  const body = `
    <article>
      <section>
        <p><strong>Client readiness report</strong> · <strong>Pre-verification readiness assessment</strong></p>
        <h1>${escapeHtml(context.projectName)}</h1>
        <p>${escapeHtml(context.methodologyCode)}@${escapeHtml(context.methodologyVersion)}${context.methodologyName ? ` · ${escapeHtml(context.methodologyName)}` : ""}</p>
        <p>${escapeHtml(report.executiveReadinessSummary.headline)}</p>
        <p>This readiness report is a client-facing preparation tool. It is not a verifier decision and does not determine registration, issuance, or quantified carbon outcomes.</p>
        <dl>
          ${context.projectId ? `<dt>Project ID</dt><dd>${escapeHtml(context.projectId)}</dd>` : ""}
          ${context.proponent ? `<dt>Proponent</dt><dd>${escapeHtml(context.proponent)}</dd>` : ""}
          ${context.region ? `<dt>Region</dt><dd>${escapeHtml(context.region)}</dd>` : ""}
          ${context.sector ? `<dt>Sector</dt><dd>${escapeHtml(context.sector)}</dd>` : ""}
          <dt>Report ID</dt><dd>${escapeHtml(report.reportId)}</dd>
          <dt>Generated</dt><dd>${escapeHtml(report.technicalAppendix.generatedAt)}</dd>
        </dl>
      </section>

      <section>
        <h2>Executive Readiness Summary</h2>
        <p>Totals are readiness categories, not a formal assurance score. Missing evidence may include rules that are also not started.</p>
        <ul>
          <li>Position: ${escapeHtml(report.executiveReadinessSummary.readinessPosition)}</li>
          <li>Ready: ${totals.ready}</li>
          <li>Missing evidence / not started: ${totals.missingEvidence} (includes ${totals.notStarted} not-started items)</li>
          <li>Clarification needed: ${totals.clarificationNeeded}</li>
          <li>Reviewer judgment needed: ${totals.reviewerJudgmentNeeded}</li>
          <li>Unknown / not assessable: ${totals.unknownOrNotAssessable}</li>
        </ul>
        ${renderList(report.executiveReadinessSummary.highlights, "No highlights listed.")}
      </section>

      <section>
        <h2>Scope, Criteria, and Limits</h2>
        <p>${escapeHtml(report.scopeCriteriaAndLimits.reportPurpose)}</p>
        <p>${escapeHtml(report.scopeCriteriaAndLimits.scopeSummary)}</p>
        ${renderList(report.scopeCriteriaAndLimits.criteriaBasis, "No criteria basis listed.")}
      </section>

      <section>
        <h2>Project and Methodology Context</h2>
        ${context.projectDescription ? `<p>${escapeHtml(context.projectDescription)}</p>` : ""}
        <p>${escapeHtml(context.methodologyCode)}@${escapeHtml(context.methodologyVersion)}</p>
      </section>

      <section>
        <h2>Documents Reviewed</h2>
        <h3>Supplied documents</h3>
        ${
          report.documentsReviewed.suppliedDocuments.length
            ? `<ul>${report.documentsReviewed.suppliedDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : "<p>No supplied documents are listed yet.</p>"
        }
        <h3>Reviewed evidence</h3>
        ${
          report.documentsReviewed.reviewedEvidence.length
            ? `<ul>${report.documentsReviewed.reviewedEvidence
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)} · linked to ${joinEscaped(item.linkedRuleIds, "")}</li>`)
                .join("")}</ul>`
            : "<p>No reviewed evidence is linked yet.</p>"
        }
      </section>

      <section>
        <h2>Missing Documents</h2>
        ${
          report.documentsReviewed.missingDocuments.length
            ? `<ul>${report.documentsReviewed.missingDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : "<p>No missing documents are listed right now.</p>"
        }
      </section>

      <section>
        <h2>Readiness Assessment Approach</h2>
        <p>${escapeHtml(report.readinessAssessmentApproach.approachSummary)}</p>
        <p><strong>Evidence policy:</strong> ${escapeHtml(report.readinessAssessmentApproach.evidencePolicy)}</p>
        <p><strong>Reviewer judgment policy:</strong> ${escapeHtml(report.readinessAssessmentApproach.reviewerJudgmentPolicy)}</p>
      </section>

      <section>
        <h2>Rule Findings Matrix</h2>
        <p>VVB-shaped rule findings for readiness review only. These rows summarize readiness conditions, not a verifier conclusion.</p>
        <table>
          <thead>
            <tr><th>Rule</th><th>Category</th><th>Severity</th><th>Assessment</th><th>Next actions</th></tr>
          </thead>
          <tbody>
            ${renderRuleRows(report)}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Open Findings</h2>
        ${renderOpenFindingsGroup("Open Findings: Missing Evidence", "Rules that still need expected evidence or have not yet started from a readiness standpoint.", report.openFindings.missingEvidence)}
        ${renderOpenFindingsGroup("Open Findings: Clarification Needed", "Rules that still need reviewer clarification before the readiness record is stable.", report.openFindings.clarificationNeeded)}
        ${renderOpenFindingsGroup("Open Findings: Reviewer Judgment Needed", "Rules with linked evidence but without a sufficiently recorded reviewer judgment.", report.openFindings.reviewerJudgmentNeeded)}
        ${renderOpenFindingsGroup("Open Findings: Unknown or Not Assessable", "Rules where encoded expectations are still incomplete or not yet assessable.", report.openFindings.unknownOrNotAssessable)}
      </section>

      <section>
        <h2>Evidence Checklist</h2>
        <p>Expected, linked, and still-missing evidence are shown rule by rule.</p>
        <table>
          <thead>
            <tr><th>Rule</th><th>Expected</th><th>Linked</th><th>Missing</th><th>State</th></tr>
          </thead>
          <tbody>
            ${renderEvidenceChecklistRows(report)}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Recommended Corrective Actions</h2>
        ${
          report.recommendedCorrectiveActions.items.length
            ? `<ul>${report.recommendedCorrectiveActions.items
                .map((item) => `<li><strong>${escapeHtml(item.ruleId)}</strong> ${escapeHtml(item.ruleTitle)} · ${escapeHtml(item.priority)} priority · ${escapeHtml(item.action)} · ${escapeHtml(item.basis)}</li>`)
                .join("")}</ul>`
            : "<p>No corrective actions are currently listed because all assessed rules are marked ready for readiness review.</p>"
        }
      </section>

      <section>
        <h2>Limitations</h2>
        ${renderList([...report.executiveReadinessSummary.limitations, ...report.scopeCriteriaAndLimits.limitations], "No limitations listed.")}
      </section>

      <section>
        <h2>Technical Appendix</h2>
        <p>Appendix material is included for HTML/PDF export readiness and reviewer traceability.</p>
        ${renderList(report.technicalAppendix.disclaimers, "No appendix disclaimers listed.")}
        <h3>State definitions</h3>
        ${renderList(report.technicalAppendix.stateDefinitions.map((item) => `${item.state.replaceAll("_", " ")} · ${item.description}`), "No state definitions listed.")}
        <h3>Evidence reference index</h3>
        ${
          report.technicalAppendix.evidenceReferenceIndex.length
            ? `<ul>${report.technicalAppendix.evidenceReferenceIndex
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)} · linked to ${joinEscaped(item.linkedRuleIds, "")}</li>`)
                .join("")}</ul>`
            : "<p>No evidence references are indexed yet.</p>"
        }
      </section>
    </article>`;
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charSet="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${report.projectAndMethodologyContext.projectName} client readiness report</title>`,
    "<style>",
    "body{margin:0;background:#f8fafc;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
    ".report-shell{max-width:1040px;margin:0 auto;padding:24px;}",
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
  const found = FORBIDDEN_CLAIMS.find((claim) => haystack.includes(claim));
  if (found) {
    throw new Error(`Client readiness export contains forbidden claim language: ${found}`);
  }
}

export function buildClientReadinessAppendixArtifact(input: BuildClientReadinessReportExportInput): ClientReadinessAppendixArtifact {
  const readinessGaps = [...input.readinessGaps].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const evidenceReferenceIndex = [...input.report.technicalAppendix.evidenceReferenceIndex].sort((a, b) => a.id.localeCompare(b.id));

  return {
    kind: "article6.client_readiness_appendix",
    version: 1,
    reportId: input.report.reportId,
    generatedAt: input.report.technicalAppendix.generatedAt,
    project: input.report.projectAndMethodologyContext,
    methodology: {
      code: input.report.projectAndMethodologyContext.methodologyCode,
      version: input.report.projectAndMethodologyContext.methodologyVersion,
      name: input.report.projectAndMethodologyContext.methodologyName,
      sector: input.report.projectAndMethodologyContext.sector,
    },
    limitations: [
      ...input.report.executiveReadinessSummary.limitations,
      ...input.report.scopeCriteriaAndLimits.limitations,
      ...input.report.technicalAppendix.disclaimers,
    ],
    traceability: {
      ruleCount: readinessGaps.length,
      evidenceCount: evidenceReferenceIndex.length,
      rules: readinessGaps.map((gap) => ({
        ruleId: gap.ruleId,
        ruleTitle: gap.title,
        state: gap.state,
        severity: gap.severity,
        baseState: gap.baseState,
        baseSeverity: gap.baseSeverity,
        missingExpectedEvidence: gap.missingExpectedEvidenceTypes.map(expectedEvidenceLabel),
        recommendations: gap.recommendations.map((item) => item.label),
        linkedEvidence: [...gap.linkedEvidence]
          .map((item) => ({
            id: item.id,
            label: evidenceLabel(item),
            type: item.type,
            source: item.source,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        override: gap.override
          ? {
              state: gap.override.state ?? null,
              severity: gap.override.severity ?? null,
              reason: gap.override.reason,
              reviewer: gap.override.reviewer ?? null,
              updatedAt: gap.override.updatedAt ?? null,
            }
          : null,
      })),
    },
    evidenceReferenceIndex,
  };
}

export function buildClientReadinessReportExport(
  input: BuildClientReadinessReportExportInput,
): ClientReadinessReportExportResult {
  const appendix = buildClientReadinessAppendixArtifact(input);
  const reportJson = canonicalStringify(flattenForCanonicalJson(input.report));
  const appendixJson = canonicalStringify(flattenForCanonicalJson(appendix));
  const evidenceIndexJson = canonicalStringify(flattenForCanonicalJson(appendix.evidenceReferenceIndex));
  const html = reportHtmlDocument(input.report);

  assertNoForbiddenClaims([reportJson, appendixJson, evidenceIndexJson, html].join("\n"));

  const fileEntries = [
    {
      path: "client-readiness-report/report.json",
      bytes: Buffer.from(reportJson, "utf8"),
    },
    {
      path: "client-readiness-report/report.html",
      bytes: Buffer.from(html, "utf8"),
    },
    {
      path: "client-readiness-report/appendix/audit-pack-appendix.json",
      bytes: Buffer.from(appendixJson, "utf8"),
    },
    {
      path: "client-readiness-report/appendix/evidence-reference-index.json",
      bytes: Buffer.from(evidenceIndexJson, "utf8"),
    },
  ].sort((a, b) => a.path.localeCompare(b.path));

  const manifest: ClientReadinessExportManifest = {
    kind: "article6.client_readiness_export",
    version: 1,
    generated_at: input.report.technicalAppendix.generatedAt,
    report_id: input.report.reportId,
    files: fileEntries.map((entry) => ({
      path: entry.path,
      sha256: sha256Hex(entry.bytes),
      bytes: entry.bytes.length,
    })),
  };

  const manifestBytes = Buffer.from(canonicalStringify(flattenForCanonicalJson(manifest)), "utf8");
  const mtime = isoForZip(input.report.technicalAppendix.generatedAt);
  const zipEntries: Record<string, Uint8Array | [Uint8Array, { mtime: Date }]> = {
    "manifest.json": [new Uint8Array(manifestBytes), { mtime }],
  };

  for (const entry of fileEntries) {
    zipEntries[entry.path] = [new Uint8Array(entry.bytes), { mtime }];
  }

  const zipBytes = Buffer.from(zipSync(zipEntries, { level: 0 }));
  return {
    zipBytes,
    manifest,
    appendix,
    html,
  };
}
