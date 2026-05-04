import { zipSync } from "fflate";
import { renderToStaticMarkup } from "react-dom/server";
import ClientReadinessReportView from "@/components/readiness/ClientReadinessReportView";
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

function reportHtmlDocument(report: ClientReadinessReport): string {
  const body = renderToStaticMarkup(<ClientReadinessReportView report={report} />);
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
