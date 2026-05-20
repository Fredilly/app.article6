import { zipSync } from "fflate";
import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RequirementCoverageExpectedEvidenceType } from "@/app/m/_lib/requirementCoverage";
import { canonicalStringify, sha256Hex } from "@/integrity/artifacts";
import type { ClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";
import {
  escapeHtml,
  joinEscaped,
  renderList,
  renderMetricCard,
  renderReportHtmlDocument,
} from "@/lib/readiness/reportHtmlTheme";
import { buildExportConventions } from "@/lib/export/conventions";

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
  export_conventions: ReturnType<typeof buildExportConventions>;
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

function renderRuleRows(report: ClientReadinessReport): string {
  return report.ruleFindingsMatrix
    .map(
      (item) => `
        <tr>
          <td><span class="cell-title">${escapeHtml(item.ruleId)}</span><span class="cell-subtitle">${escapeHtml(item.ruleTitle)}</span></td>
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
          <td><span class="cell-title">${escapeHtml(item.ruleId)}</span><span class="cell-subtitle">${escapeHtml(item.ruleTitle)}</span></td>
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
    <section class="report-section">
      <div class="section-kicker">Open findings</div>
      <h3 class="section-title">${escapeHtml(title)}</h3>
      <div class="section-body">
      <p>${escapeHtml(description)}</p>
      ${
        items.length
          ? `<ul>${items
              .map(
                (item) => `<li><strong>${escapeHtml(item.ruleId)}</strong> ${escapeHtml(item.ruleTitle)} · ${escapeHtml(item.severity)} · ${escapeHtml(item.assessment)} · Next: ${joinEscaped(item.nextActions, "Reviewer follow-up still needs to be defined.")}</li>`,
              )
              .join("")}</ul>`
          : '<p class="empty-note">No items in this group right now.</p>'
      }
      </div>
    </section>`
}

function reportHtmlDocument(report: ClientReadinessReport): string {
  const context = report.projectAndMethodologyContext;
  const totals = report.executiveReadinessSummary.totals;
  const executiveCards = [
    renderMetricCard("Readiness position", report.executiveReadinessSummary.readinessPosition),
    renderMetricCard("Ready", String(totals.ready), `${totals.rules} assessed rule${totals.rules === 1 ? "" : "s"}`),
    renderMetricCard("Missing or not started", String(totals.missingEvidence), `${totals.notStarted} not-started item${totals.notStarted === 1 ? "" : "s"}`),
    renderMetricCard("Reviewer judgment needed", String(totals.reviewerJudgmentNeeded), `${totals.clarificationNeeded} clarification item${totals.clarificationNeeded === 1 ? "" : "s"}`),
  ].join("");
  const body = `
      <section class="report-section">
        <div class="section-kicker">Executive summary</div>
        <h2 class="section-title">Readiness position</h2>
        <div class="section-body">
          <p>Totals are readiness categories, not a formal assurance score. Missing evidence may overlap with rules that are also not started.</p>
          ${renderList(report.executiveReadinessSummary.highlights, "No highlights listed.")}
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Scope</div>
        <h2 class="section-title">Scope, criteria, and limits</h2>
        <div class="section-body">
          <p>${escapeHtml(report.scopeCriteriaAndLimits.reportPurpose)}</p>
          <p>${escapeHtml(report.scopeCriteriaAndLimits.scopeSummary)}</p>
          <h3 class="subsection-title">Criteria basis</h3>
          ${renderList(report.scopeCriteriaAndLimits.criteriaBasis, "No criteria basis listed.")}
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Project context</div>
        <h2 class="section-title">Project and methodology context</h2>
        <div class="section-body">
          ${context.projectDescription ? `<p>${escapeHtml(context.projectDescription)}</p>` : '<p class="empty-note">No project description provided.</p>'}
          <div class="pill-row">
            <span class="pill">${escapeHtml(context.methodologyCode)}@${escapeHtml(context.methodologyVersion)}</span>
            ${context.methodologyName ? `<span class="pill">${escapeHtml(context.methodologyName)}</span>` : ""}
            ${context.sector ? `<span class="pill">${escapeHtml(context.sector)}</span>` : ""}
          </div>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Evidence base</div>
        <h2 class="section-title">Documents reviewed</h2>
        <div class="section-body">
        <h3 class="subsection-title">Supplied documents</h3>
        ${
          report.documentsReviewed.suppliedDocuments.length
            ? `<ul>${report.documentsReviewed.suppliedDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No supplied documents are listed yet.</p>'
        }
        <h3 class="subsection-title">Reviewed evidence</h3>
        ${
          report.documentsReviewed.reviewedEvidence.length
            ? `<ul>${report.documentsReviewed.reviewedEvidence
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)} · linked to ${joinEscaped(item.linkedRuleIds, "")}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No reviewed evidence is linked yet.</p>'
        }
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Missing inputs</div>
        <h2 class="section-title">Missing documents</h2>
        <div class="section-body">
        ${
          report.documentsReviewed.missingDocuments.length
            ? `<ul>${report.documentsReviewed.missingDocuments
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No missing documents are listed right now.</p>'
        }
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Method</div>
        <h2 class="section-title">Readiness assessment approach</h2>
        <div class="section-body">
          <p>${escapeHtml(report.readinessAssessmentApproach.approachSummary)}</p>
          <p><strong>Evidence policy:</strong> ${escapeHtml(report.readinessAssessmentApproach.evidencePolicy)}</p>
          <p><strong>Reviewer judgment policy:</strong> ${escapeHtml(report.readinessAssessmentApproach.reviewerJudgmentPolicy)}</p>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Findings</div>
        <h2 class="section-title">Rule findings matrix</h2>
        <div class="section-body">
        <p>These rows summarize readiness conditions, not a verifier conclusion.</p>
        <table class="report-table">
          <thead>
            <tr><th>Rule</th><th>Category</th><th>Severity</th><th>Assessment</th><th>Next actions</th></tr>
          </thead>
          <tbody>
            ${renderRuleRows(report)}
          </tbody>
        </table>
        </div>
      </section>

        ${renderOpenFindingsGroup("Open Findings: Missing Evidence", "Rules that still need expected evidence or have not yet started from a readiness standpoint.", report.openFindings.missingEvidence)}
        ${renderOpenFindingsGroup("Open Findings: Clarification Needed", "Rules that still need reviewer clarification before the readiness record is stable.", report.openFindings.clarificationNeeded)}
        ${renderOpenFindingsGroup("Open Findings: Reviewer Judgment Needed", "Rules with linked evidence but without a sufficiently recorded reviewer judgment.", report.openFindings.reviewerJudgmentNeeded)}
        ${renderOpenFindingsGroup("Open Findings: Unknown or Not Assessable", "Rules where encoded expectations are still incomplete or not yet assessable.", report.openFindings.unknownOrNotAssessable)}

      <section class="report-section">
        <div class="section-kicker">Checklist</div>
        <h2 class="section-title">Evidence checklist</h2>
        <div class="section-body">
        <p>Expected, linked, and still-missing evidence are shown rule by rule.</p>
        <table class="report-table">
          <thead>
            <tr><th>Rule</th><th>Expected</th><th>Linked</th><th>Missing</th><th>State</th></tr>
          </thead>
          <tbody>
            ${renderEvidenceChecklistRows(report)}
          </tbody>
        </table>
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Actions</div>
        <h2 class="section-title">Recommended corrective actions</h2>
        <div class="section-body">
        ${
          report.recommendedCorrectiveActions.items.length
            ? `<ul>${report.recommendedCorrectiveActions.items
                .map((item) => `<li><strong>${escapeHtml(item.ruleId)}</strong> ${escapeHtml(item.ruleTitle)} · ${escapeHtml(item.priority)} priority · ${escapeHtml(item.action)} · ${escapeHtml(item.basis)}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No corrective actions are currently listed because all assessed rules are marked ready for readiness review.</p>'
        }
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Limits</div>
        <h2 class="section-title">Limitations</h2>
        <div class="section-body">
        ${renderList([...report.executiveReadinessSummary.limitations, ...report.scopeCriteriaAndLimits.limitations], "No limitations listed.")}
        </div>
      </section>

      <section class="report-section">
        <div class="section-kicker">Appendix</div>
        <h2 class="section-title">Technical appendix</h2>
        <div class="section-body">
        <p>Appendix material is included for HTML and PDF export readiness and reviewer traceability.</p>
        <h3 class="subsection-title">Disclaimers</h3>
        ${renderList(report.technicalAppendix.disclaimers, "No appendix disclaimers listed.")}
        <h3 class="subsection-title">State definitions</h3>
        ${renderList(report.technicalAppendix.stateDefinitions.map((item) => `${item.state.replaceAll("_", " ")} · ${item.description}`), "No state definitions listed.")}
        <h3 class="subsection-title">Evidence reference index</h3>
        ${
          report.technicalAppendix.evidenceReferenceIndex.length
            ? `<ul>${report.technicalAppendix.evidenceReferenceIndex
                .map((item) => `<li>${escapeHtml(item.label)} · ${escapeHtml(item.type)} · linked to ${joinEscaped(item.linkedRuleIds, "")}</li>`)
                .join("")}</ul>`
            : '<p class="empty-note">No evidence references are indexed yet.</p>'
        }
        </div>
      </section>`;
  return renderReportHtmlDocument({
    title: report.executiveReadinessSummary.headline,
    reportType: "Client Readiness Report",
    scopeLabel: "Pre-verification readiness assessment",
    reportId: report.reportId,
    generatedAt: report.technicalAppendix.generatedAt,
    methodologyLabel: `${context.methodologyCode}@${context.methodologyVersion}`,
    contextLabel: context.methodologyName || context.projectName,
    bannerTitle: "Scope and non-claim notice",
    bannerBody:
      "This Article6 report is a readiness support deliverable. It does not express a verifier decision and does not determine registration, issuance, or quantified carbon outcomes.",
    heroSummary: `Article6 ${context.projectName} client readiness report`,
    executiveCards,
    body,
    footerNote: "Readiness support only. Article6 does not issue a verifier decision in this export.",
  });
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
      path: "client-readiness-report/appendix/readiness-traceability-appendix.json",
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
    export_conventions: buildExportConventions("client_readiness"),
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
