import type { DocumentFamily } from "@/lib/documentParsing";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract, ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";
import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";

export type EvidenceCheckId =
  | "project_title"
  | "host_country"
  | "project_location"
  | "methodology"
  | "crediting_period"
  | "project_activity";

export type EvidenceCheckStatus = "found" | "missing" | "not_applicable";

export type EvidenceCheck = {
  id: EvidenceCheckId;
  label: string;
  question: string;
};

export type EvidenceCheckResult = {
  checkId: EvidenceCheckId;
  status: EvidenceCheckStatus;
  answerText: string;
  downgradeReason: string;
  quotes: string[];
  pages: number[];
  sections: string[];
  evidenceSpanIds: string[];
  warnings: string[];
};

export type EvidenceAnswerShape =
  | "project_title"
  | "country"
  | "location"
  | "methodology_code_version"
  | "date_range"
  | "project_activity_type";

export type EvidenceCheckContract = {
  checkId: EvidenceCheckId;
  applicableDocumentFamilies: Array<"pdd" | "validation_report" | "verification_report" | "monitoring_report" | "unknown" | "any">;
  expectedShape: EvidenceAnswerShape;
  allowedFactFields: Array<keyof ProjectFactContract>;
};

export type CheckValidationContext = {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
  routerResult: DeterministicRouterResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
  methodologyId?: string;
};

type EvidenceCheckValidationResult = Omit<EvidenceCheckResult, "checkId">;

type ResolvedFieldCandidate = {
  factField: keyof ProjectFactContract;
  field: ProjectFactField<string | null>;
  span: EvidenceSpan;
};

const PROJECT_IDENTITY_CHECKS: EvidenceCheck[] = [
  { id: "project_title", label: "Project title", question: "What is the project title?" },
  { id: "host_country", label: "Host country", question: "What is the host country?" },
  { id: "project_location", label: "Project location", question: "What is the project location?" },
  { id: "methodology", label: "Methodology", question: "What methodology was applied?" },
  { id: "crediting_period", label: "Crediting period / GHG accounting period", question: "What is the crediting period / GHG accounting period?" },
  { id: "project_activity", label: "Project activity", question: "What is the project activity?" },
];

const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  project_title: {
    checkId: "project_title",
    applicableDocumentFamilies: ["any"],
    expectedShape: "project_title",
    allowedFactFields: ["projectTitle"],
  },
  host_country: {
    checkId: "host_country",
    applicableDocumentFamilies: ["any"],
    expectedShape: "country",
    allowedFactFields: ["hostCountry", "projectCountry"],
  },
  project_location: {
    checkId: "project_location",
    applicableDocumentFamilies: ["any"],
    expectedShape: "location",
    allowedFactFields: ["projectLocation"],
  },
  methodology: {
    checkId: "methodology",
    applicableDocumentFamilies: ["any"],
    expectedShape: "methodology_code_version",
    allowedFactFields: ["methodologyPrimary"],
  },
  crediting_period: {
    checkId: "crediting_period",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    expectedShape: "date_range",
    allowedFactFields: ["creditingPeriod"],
  },
  project_activity: {
    checkId: "project_activity",
    applicableDocumentFamilies: ["any"],
    expectedShape: "project_activity_type",
    allowedFactFields: ["projectType"],
  },
};

const PRIMARY_METHODOLOGY_RE = /\b(?:AR-ACM|AR-AM|VM|VCS|ACM|AMS|AM|CDM|GS)[-\s]?[A-Z]?\d{3,5}[A-Z0-9-]*(?:\s*(?:v|version)?\.?\s*\d[\w.-]*)?\b/i;
const DATE_RANGE_RE = /(?:\bto\b|\bthrough\b|\buntil\b|\bfrom\b|\bbetween\b|[-–—])/i;
const DATE_TOKEN_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-][A-Za-z]+[/-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4})\b/gi;
const IDENTITY_SECTION_RE = /\b(?:project title|project description document|project design document|project summary|summary description of the project|project overview|project details|project location|project type|country\/area|host country|host party|title and reference of methodology(?: applied)?|application of methodology|methodology applied|project crediting period|ghg accounting period|project lifetime|sectoral scope and project type|description of the project activity|type of project activity)\b/i;
const UNTRUSTED_TEXT_RE = /^\s*(?:source\s*:|figure\b|table\b|appendix\b|annex\b|equation\b|http\b|www\.)/i;
const UNTRUSTED_HEADING_RE = /\b(?:acknowledg(?:e)?ments?|references?|bibliograph(?:y|ies)|annex|appendix|deviation(?:s)? from methodology|methodology deviation)\b/i;
const LOCATION_BANNED_RE = /\b(?:map source|global administrative areas|gadm|http|www\.)\b/i;
const ACTIVITY_BANNED_RE = /\b(?:rhizophora|chave|dbh|agb|bgb|allometric|equation|equations|figure|table|chart)\b/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactText(value: string, limit = 800): string {
  const normalized = normalizeText(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function documentFamilyBucket(family: DocumentFamily | undefined): EvidenceCheckContract["applicableDocumentFamilies"][number] {
  switch (family) {
    case "CDM_PDD":
    case "GOLD_STANDARD_PDD":
    case "VCS_PD":
    case "VERRA_PD":
    case "REDD_AFOLU":
    case "ENERGY":
      return "pdd";
    case "UNKNOWN":
    default:
      return "unknown";
  }
}

function documentFamilyApplies(contract: EvidenceCheckContract, family: DocumentFamily | undefined): boolean {
  return contract.applicableDocumentFamilies.includes("any")
    || contract.applicableDocumentFamilies.includes(documentFamilyBucket(family));
}

function fieldMap(contract: ProjectFactContract): Record<keyof ProjectFactContract, ProjectFactField | string[] | ProjectFactContract["warnings"] | DocumentFamily> {
  return contract as unknown as Record<keyof ProjectFactContract, ProjectFactField | string[] | ProjectFactContract["warnings"] | DocumentFamily>;
}

function spanById(document: EvidenceDocument): Map<string, EvidenceSpan> {
  return new Map(document.spans.map((span) => [span.spanId, span]));
}

function isTrustedIdentitySpan(span: EvidenceSpan): boolean {
  const text = normalizeText(span.text);
  const heading = normalizeText([span.heading ?? "", ...span.headingPath, ...span.sectionPath].join(" "));
  if (!text) return false;
  if (span.reliability === "excluded") return false;
  if (span.layout?.repeatedHeaderFooter) return false;
  if (span.blockType === "header" || span.blockType === "footer" || span.blockType === "toc") return false;
  if (UNTRUSTED_TEXT_RE.test(text)) return false;
  if (UNTRUSTED_HEADING_RE.test(heading)) return false;
  return true;
}

function resolveFieldCandidate(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
): ResolvedFieldCandidate | null {
  const fields = fieldMap(ctx.projectFactContract);
  const spans = spanById(ctx.evidenceDocument);

  for (const factField of contract.allowedFactFields) {
    const candidate = fields[factField];
    if (!candidate || typeof candidate !== "object" || !("value" in candidate)) continue;
    const field = candidate as ProjectFactField<string | null>;
    if (typeof field.value !== "string" || !normalizeText(field.value)) continue;
    if (field.extractionRule === "structured-input" || field.extractionRule.endsWith(":family")) continue;
    if (field.evidenceSpanIds.length === 0) continue;
    const span = field.evidenceSpanIds
      .map((spanId) => spans.get(spanId))
      .filter((value): value is EvidenceSpan => value != null)
      .find((value) => isTrustedIdentitySpan(value));
    if (!span) continue;
    return { factField, field, span };
  }

  return null;
}

function buildSections(field: ProjectFactField<string | null>, span: EvidenceSpan, factField: string): string[] {
  if (field.sectionPath.length > 0) return [field.sectionPath.join(" > ")];
  if (span.sectionPath.length > 0) return [span.sectionPath.join(" > ")];
  if (span.heading?.trim()) return [span.heading.trim()];
  return [factField];
}

function missingResult(reason: string, warnings: string[] = []): EvidenceCheckValidationResult {
  return {
    status: "missing",
    answerText: "Not found in document.",
    downgradeReason: reason,
    quotes: [],
    pages: [],
    sections: [],
    evidenceSpanIds: [],
    warnings,
  };
}

function notApplicableResult(reason: string): EvidenceCheckValidationResult {
  return {
    status: "not_applicable",
    answerText: "Not applicable for this document.",
    downgradeReason: reason,
    quotes: [],
    pages: [],
    sections: [],
    evidenceSpanIds: [],
    warnings: ["document_family_mismatch"],
  };
}

function foundResult(candidate: ResolvedFieldCandidate): EvidenceCheckValidationResult {
  const answerText = normalizeText(candidate.field.value ?? "");
  const quote = compactText(candidate.span.text);
  const pages = dedupe([
    ...candidate.field.pageNumbers,
    ...(candidate.span.page == null ? [] : [candidate.span.page]),
  ]).sort((left, right) => left - right);
  const sections = buildSections(candidate.field, candidate.span, String(candidate.factField));
  const evidenceSpanIds = dedupe(candidate.field.evidenceSpanIds.filter((spanId) => spanId === candidate.span.spanId || Boolean(spanId)));

  if (!answerText || !quote || evidenceSpanIds.length === 0 || (pages.length === 0 && sections.length === 0)) {
    return missingResult(`Searched deterministic project fact sources for ${candidate.factField} but the evidence provenance was incomplete.`, ["incomplete_evidence_provenance"]);
  }

  return {
    status: "found",
    answerText,
    downgradeReason: "",
    quotes: [quote],
    pages,
    sections,
    evidenceSpanIds,
    warnings: dedupe(candidate.field.warnings),
  };
}

function validateProjectTitle(candidate: ResolvedFieldCandidate): string | null {
  if (wordCount(candidate.field.value ?? "") < 2) return "Project title is too short.";
  if (PRIMARY_METHODOLOGY_RE.test(candidate.field.value ?? "")) return "Project title cannot be methodology text.";
  return null;
}

function validateHostCountry(candidate: ResolvedFieldCandidate): string | null {
  const value = normalizeText(candidate.field.value ?? "");
  if (!value) return "Host country was empty.";
  if (value.includes(",") || /\bprovince\b|\bdistrict\b|\bregency\b|\bcoordinates?\b/i.test(value)) {
    return "Host country cannot be a location string.";
  }
  if (/\bportugal\b/i.test(value)) return "Host country matched an excluded citation/source country.";
  return null;
}

function validateProjectLocation(candidate: ResolvedFieldCandidate): string | null {
  const value = normalizeText(candidate.field.value ?? "");
  if (wordCount(value) < 2) return "Project location is too short.";
  if (LOCATION_BANNED_RE.test(value)) {
    return "Project location included map-source or citation text.";
  }
  return null;
}

function validateMethodology(candidate: ResolvedFieldCandidate): string | null {
  const value = normalizeText(candidate.field.value ?? "");
  if (!PRIMARY_METHODOLOGY_RE.test(value)) return "Methodology evidence must contain a methodology code.";
  if (UNTRUSTED_TEXT_RE.test(value) || /deviation(?:s)? from methodology|methodology deviation/i.test(candidate.span.text)) {
    return "Methodology evidence came from excluded methodology-deviation text.";
  }
  return null;
}

function validateCreditingPeriod(candidate: ResolvedFieldCandidate): string | null {
  const value = normalizeText(candidate.field.value ?? "");
  const matches = value.match(DATE_TOKEN_RE) ?? [];
  if (matches.length < 2 || !DATE_RANGE_RE.test(value)) return "Crediting period must contain a clear date range.";
  return null;
}

function validateProjectActivity(candidate: ResolvedFieldCandidate): string | null {
  const value = normalizeText(candidate.field.value ?? "");
  if (!value) return "Project activity was empty.";
  if (ACTIVITY_BANNED_RE.test(value) || ACTIVITY_BANNED_RE.test(candidate.span.text)) {
    return "Project activity matched excluded biomass, equation, or chart text.";
  }
  if (!IDENTITY_SECTION_RE.test([candidate.span.heading ?? "", ...candidate.span.sectionPath].join(" ")) && wordCount(value) < 2) {
    return "Project activity lacked trusted identity context.";
  }
  return null;
}

function validateCandidate(contract: EvidenceCheckContract, candidate: ResolvedFieldCandidate): string | null {
  switch (contract.checkId) {
    case "project_title":
      return validateProjectTitle(candidate);
    case "host_country":
      return validateHostCountry(candidate);
    case "project_location":
      return validateProjectLocation(candidate);
    case "methodology":
      return validateMethodology(candidate);
    case "crediting_period":
      return validateCreditingPeriod(candidate);
    case "project_activity":
      return validateProjectActivity(candidate);
  }
}

export function validateCheck(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
): EvidenceCheckValidationResult {
  const detectedFamily = ctx.projectFactContract.documentFamily ?? ctx.evidenceDocument.documentFamily;
  if (!documentFamilyApplies(contract, detectedFamily)) {
    return notApplicableResult(`Check ${contract.checkId} does not apply to detected document family ${documentFamilyBucket(detectedFamily)}.`);
  }

  const candidate = resolveFieldCandidate(contract, ctx);
  if (!candidate) {
    return missingResult(`Searched deterministic project fact sources for ${contract.checkId} and found no trusted evidence.`, ["no_candidate_evidence"]);
  }

  const validationError = validateCandidate(contract, candidate);
  if (validationError) {
    return missingResult(`Searched deterministic project fact sources for ${contract.checkId}. Related evidence was rejected: ${validationError}`, dedupe(["contract_validation_failed", ...candidate.field.warnings]));
  }

  return foundResult(candidate);
}

export function getContract(checkId: EvidenceCheckId): EvidenceCheckContract {
  return CONTRACTS[checkId];
}

export function getUniversalChecks(): EvidenceCheck[] {
  return [];
}

export function getProjectIdentityChecks(): EvidenceCheck[] {
  return PROJECT_IDENTITY_CHECKS;
}

export function getMethodologyChecks(): EvidenceCheck[] {
  return [];
}

export function getAllChecks(): EvidenceCheck[] {
  return PROJECT_IDENTITY_CHECKS;
}

export function statusFromRouter(
  routerStatus: "answered" | "unclear" | "no_evidence",
): EvidenceCheckStatus {
  return routerStatus === "answered" ? "found" : "missing";
}
