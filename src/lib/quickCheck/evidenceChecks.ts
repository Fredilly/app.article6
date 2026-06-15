/**
 * Evidence Checks: reusable contract validation for structured Quick Check
 * questions. The router retrieves candidates broadly; this layer decides
 * whether a candidate is valid evidence for a specific check.
 */

import type { DocumentFamily } from "@/lib/documentParsing";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract, ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";
import type { ProjectFactId } from "@/lib/quickCheck/queryIntent/types";
import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";

// -- Check and result types --------------------------------------------------

export type EvidenceCheckId =
  | "project_activity" | "host_country" | "project_location" | "methodology"
  | "crediting_period" | "monitoring_period" | "baseline_scenario"
  | "additionality" | "leakage" | "safeguards" | "environmental_impacts"
  | "stakeholder_consultation"
  | "vm0007_boundary" | "vm0007_leakage_belt" | "vm0007_reference_region"
  | "vm0007_baseline_deforestation" | "vm0007_carbon_pools" | "vm0007_monitoring_plan"
  | "ar_acm0003_arr_activity" | "ar_acm0003_boundary"
  | "ar_acm0003_carbon_pools" | "ar_acm0003_monitoring_plan";

export type EvidenceCheckStatus = "found" | "missing" | "unclear" | "not_applicable";

export type EvidenceCheck = {
  id: EvidenceCheckId;
  label: string;
  question: string;
  methodologySpecific?: string;
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

export type EvidenceSourceType =
  | "cover_title_block"
  | "structured_fact_table"
  | "project_summary"
  | "project_details"
  | "methodology_section"
  | "baseline_section"
  | "additionality_section"
  | "monitoring_section"
  | "leakage_section"
  | "safeguard_stakeholder_environment_section"
  | "generic_body_text"
  | "page_header_footer_artifact"
  | "structured_default_input";

export type EvidenceAnswerShape =
  | "country"
  | "location"
  | "methodology_code_version"
  | "date"
  | "date_range"
  | "project_activity_type"
  | "narrative_explanation"
  | "boundary_reference_region_leakage_belt"
  | "monitoring_plan_evidence";

export type EvidenceMismatchRuleId =
  | "reject_artifact_or_default_input"
  | "reject_heading_only"
  | "reject_reused_answer_from_other_check"
  | "reject_wrong_section_semantics"
  | "reject_crediting_period_for_monitoring_period"
  | "reject_monitoring_period_for_crediting_period"
  | "reject_project_description_for_baseline_additionality_leakage"
  | "reject_stakeholder_for_safeguards_unless_allowed"
  | "reject_location_without_country_for_host_country"
  | "reject_methodology_modules_without_primary";

export type DocumentFamilyFilter =
  | "pdd"
  | "validation_report"
  | "verification_report"
  | "monitoring_report"
  | "unknown"
  | "any";

type SearchTarget = "fact_contract" | "section" | "router";

export type EvidenceCheckContract = {
  checkId: EvidenceCheckId;
  applicableDocumentFamilies: DocumentFamilyFilter[];
  applicableMethodologies?: string[];
  searchTargets: SearchTarget[];
  allowedSourceTypes: EvidenceSourceType[];
  expectedShape: EvidenceAnswerShape;
  mismatchRules: EvidenceMismatchRuleId[];
  allowedAnchorTerms: string[];
  forbiddenAnchorTerms: string[];
  semanticTerms: string[];
  allowedFactFields: ProjectFactId[];
  relatedFactFields: ProjectFactId[];
  requiresGroundedEvidence: boolean;
  minimumEvidenceWords: number;
  rejectHeadingOnly: boolean;
};

type CheckCandidate = {
  text: string;
  quote: string;
  page: number | null;
  sectionPath: string[];
  heading?: string;
  evidenceSpanIds: string[];
  source: string;
  sourceType: EvidenceSourceType;
  sourceFactField?: ProjectFactId;
  extractionRule?: string;
  blockType?: EvidenceSpan["blockType"];
  rank: number;
  warnings: string[];
};

export type CheckValidationContext = {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
  routerResult: DeterministicRouterResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
  methodologyId?: string;
};

type CandidateValidation = {
  valid: boolean;
  reason: string;
};

type EvidenceCheckValidationResult = Omit<EvidenceCheckResult, "checkId">;

const DATE_TOKEN_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{4})\b/gi;
const PRIMARY_METHODOLOGY_RE = /\b(?:AR-ACM|AR-AM|VM|VCS|ACM|AMS|AM|CDM|GS)[-\s]?[A-Z]?\d{3,5}[A-Z0-9-]*(?:\s*(?:v|version)?\.?\s*\d[\w.-]*)?\b/i;
const ARTIFACT_RE = /^(?:page\s+\d+|version\s+\d|v\d+(?:\.\d+)*|copyright|confidential|table\s+of\s+contents|contents|project description document|validation report|verification report|monitoring report)\b/i;
const TEMPLATE_LABEL_RE = /^(?:ccb|vcs|verra|cdm|gold standard)\s*(?:&|and)?\s*(?:vcs|ccb)?\s*(?:project|version|template|document)?\b/i;

const COMMON_MISMATCH_RULES: EvidenceMismatchRuleId[] = [
  "reject_artifact_or_default_input",
  "reject_heading_only",
  "reject_reused_answer_from_other_check",
  "reject_wrong_section_semantics",
];

const PDD_DOCUMENT_FAMILIES: DocumentFamily[] = [
  "CDM_PDD",
  "VCS_PD",
  "VERRA_PD",
  "GOLD_STANDARD_PDD",
  "REDD_AFOLU",
  "ENERGY",
];

const FACT_LABEL_TO_FIELD: Array<{ pattern: RegExp; field: ProjectFactId }> = [
  { pattern: /\bhost country\b|\bhost party\b/i, field: "hostCountry" },
  { pattern: /\bproject country\b|\bcountry\/area\b/i, field: "projectCountry" },
  { pattern: /\bproject location\b|\bgeographic(?:al)? (?:location|reference)\b|\bproject site\b/i, field: "projectLocation" },
  { pattern: /\bmethodology\b|\bmethodology applied\b|\btitle and reference\b/i, field: "methodologyPrimary" },
  { pattern: /\bmodule\b|\btool\b/i, field: "methodologyModules" },
  { pattern: /\bcrediting period\b|\bghg accounting period\b|\bproject lifetime\b/i, field: "creditingPeriod" },
  { pattern: /\breporting period\b/i, field: "reportingPeriod" },
  { pattern: /\bmonitoring period\b|\bverification period\b/i, field: "monitoringPeriod" },
  { pattern: /\bproject activity\b|\bproject type\b|\btype of project activity\b/i, field: "projectType" },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s./-]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(value: string, terms: string[]): boolean {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function compactText(text: string, limit = 500): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function formatFactValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean).join(", ") || null;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function fieldRecord(contract: ProjectFactContract): Record<ProjectFactId, ProjectFactField | undefined> {
  return contract as unknown as Record<ProjectFactId, ProjectFactField | undefined>;
}

function spanById(document: EvidenceDocument): Map<string, EvidenceSpan> {
  return new Map(document.spans.map((span) => [span.spanId, span]));
}

function contextText(input: {
  text?: string;
  heading?: string;
  sectionPath?: string[];
}): string {
  return [
    input.heading ?? "",
    ...(input.sectionPath ?? []),
    input.text ?? "",
  ].join(" ");
}

function isArtifactSpan(span: EvidenceSpan): boolean {
  const text = span.text.trim();
  return span.reliability === "excluded"
    || span.layout?.repeatedHeaderFooter === true
    || span.blockType === "header"
    || span.blockType === "footer"
    || span.blockType === "toc"
    || ARTIFACT_RE.test(text)
    || (TEMPLATE_LABEL_RE.test(text) && wordCount(text) <= 6);
}

function classifyEvidenceSource(input: {
  text: string;
  page: number | null;
  sectionPath: string[];
  heading?: string;
  blockType?: EvidenceSpan["blockType"];
  reliability?: EvidenceSpan["reliability"];
  repeatedHeaderFooter?: boolean;
  sourceFactField?: ProjectFactId;
  extractionRule?: string;
}): EvidenceSourceType {
  if (input.extractionRule === "structured-input" || input.extractionRule?.endsWith(":family")) {
    return "structured_default_input";
  }
  if (
    input.reliability === "excluded"
    || input.repeatedHeaderFooter
    || input.blockType === "header"
    || input.blockType === "footer"
    || input.blockType === "toc"
    || ARTIFACT_RE.test(input.text.trim())
  ) {
    return "page_header_footer_artifact";
  }

  const sectionOnly = contextText({ heading: input.heading, sectionPath: input.sectionPath });
  if (includesAny(sectionOnly, ["methodology", "methodological", "title and reference"])) return "methodology_section";
  if (includesAny(sectionOnly, ["baseline", "without project", "without-project"])) return "baseline_section";
  if (includesAny(sectionOnly, ["additionality", "additional", "barrier analysis", "common practice", "investment analysis"])) return "additionality_section";
  if (includesAny(sectionOnly, ["monitoring", "reporting period", "verification period"])) return "monitoring_section";
  if (includesAny(sectionOnly, ["leakage", "activity shifting"])) return "leakage_section";
  if (includesAny(sectionOnly, ["safeguard", "stakeholder", "consultation", "environmental impact", "grievance", "fpic", "community"])) {
    return "safeguard_stakeholder_environment_section";
  }
  if (includesAny(sectionOnly, ["project summary", "summary of project", "brief description", "project overview"])) {
    return "project_summary";
  }
  if (includesAny(sectionOnly, [
    "project details",
    "project description",
    "project activity",
    "project location",
    "geographic",
    "project boundary",
    "host country",
    "country/area",
    "crediting period",
    "project lifetime",
    "project proponent",
  ])) {
    return "project_details";
  }

  if (input.blockType === "table" || input.blockType === "field") return "structured_fact_table";
  if (input.blockType === "title" || ((input.page ?? 99) <= 1 && input.sectionPath.length === 0)) return "cover_title_block";
  return "generic_body_text";
}

function inferFactFieldFromAnswer(text: string): ProjectFactId | null {
  for (const entry of FACT_LABEL_TO_FIELD) {
    if (entry.pattern.test(text)) return entry.field;
  }
  return null;
}

function detectContractDocumentFamily(ctx: CheckValidationContext): DocumentFamilyFilter {
  const frontMatter = ctx.evidenceDocument.rawText.slice(0, 12000).toLowerCase();
  if (/\bmonitoring report\b/.test(frontMatter)) return "monitoring_report";
  if (/\bverification report\b|\bverification statement\b/.test(frontMatter)) return "verification_report";
  if (/\bvalidation report\b|\bvalidation\/verification report\b/.test(frontMatter)) return "validation_report";
  if (ctx.projectFactContract.documentType === "PROJECT_DESIGN_DOCUMENT" || ctx.projectFactContract.documentType === "PROJECT_DESCRIPTION") {
    return "pdd";
  }
  if (ctx.evidenceDocument.documentFamily && PDD_DOCUMENT_FAMILIES.includes(ctx.evidenceDocument.documentFamily)) return "pdd";
  return "unknown";
}

function methodologyApplies(contract: EvidenceCheckContract, methodologyId?: string): boolean {
  if (!contract.applicableMethodologies || contract.applicableMethodologies.length === 0) return true;
  const normalized = methodologyId?.trim().toUpperCase();
  if (!normalized) return true;
  return contract.applicableMethodologies.some((methodology) => methodology.toUpperCase() === normalized);
}

function documentFamilyApplies(contract: EvidenceCheckContract, detectedFamily: DocumentFamilyFilter): boolean {
  if (contract.applicableDocumentFamilies.includes("any")) return true;
  if (detectedFamily === "unknown") return true;
  return contract.applicableDocumentFamilies.includes(detectedFamily);
}

function sourceRank(sourceType: EvidenceSourceType, contract: EvidenceCheckContract, blockType?: EvidenceSpan["blockType"]): number {
  const allowed = contract.allowedSourceTypes.includes(sourceType);
  const bodyBoost = blockType && ["paragraph", "field", "table", "formula"].includes(blockType) ? 12 : 0;
  if (sourceType === "structured_fact_table") return allowed ? 105 : 35;
  if (sourceType === "cover_title_block") return allowed ? 95 : 30;
  if (allowed) return 80 + bodyBoost;
  if (sourceType === "page_header_footer_artifact" || sourceType === "structured_default_input") return 5;
  return 25 + bodyBoost;
}

function buildFactCandidate(input: {
  fieldId: ProjectFactId;
  field: ProjectFactField;
  value: string;
  document: EvidenceDocument;
  contract: EvidenceCheckContract;
  related: boolean;
}): CheckCandidate {
  const lookup = spanById(input.document);
  const spans = input.field.evidenceSpanIds.map((id) => lookup.get(id)).filter((span): span is EvidenceSpan => Boolean(span));
  const primarySpan = spans[0];
  const quote = primarySpan?.text.trim() || input.value;
  const sourceType = primarySpan
    ? classifyEvidenceSource({
        text: primarySpan.text,
        page: primarySpan.page,
        sectionPath: primarySpan.sectionPath,
        heading: primarySpan.heading,
        blockType: primarySpan.blockType,
        reliability: primarySpan.reliability,
        repeatedHeaderFooter: primarySpan.layout?.repeatedHeaderFooter,
        sourceFactField: input.fieldId,
        extractionRule: input.field.extractionRule,
      })
    : classifyEvidenceSource({
        text: input.value,
        page: input.field.pageNumbers[0] ?? null,
        sectionPath: input.field.sectionPath,
        heading: input.field.heading,
        sourceFactField: input.fieldId,
        extractionRule: input.field.extractionRule,
      });

  return {
    text: input.value,
    quote,
    page: primarySpan?.page ?? input.field.pageNumbers[0] ?? null,
    sectionPath: primarySpan?.sectionPath ?? input.field.sectionPath,
    heading: primarySpan?.heading ?? input.field.heading,
    evidenceSpanIds: spans.length > 0 ? spans.map((span) => span.spanId) : input.field.evidenceSpanIds,
    source: `fact:${input.fieldId}`,
    sourceType,
    sourceFactField: input.fieldId,
    extractionRule: input.field.extractionRule,
    blockType: primarySpan?.blockType,
    rank: (input.related ? 20 : 120) + sourceRank(sourceType, input.contract, primarySpan?.blockType),
    warnings: input.field.warnings,
  };
}

function searchFactContract(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  if (!contract.searchTargets.includes("fact_contract")) return [];
  const candidates: CheckCandidate[] = [];
  const facts = fieldRecord(ctx.projectFactContract);
  const factIds = dedupe([...contract.allowedFactFields, ...contract.relatedFactFields]);

  for (const fieldId of factIds) {
    const field = facts[fieldId];
    const value = formatFactValue(field?.value ?? null);
    if (!field || !value) continue;
    candidates.push(buildFactCandidate({
      fieldId,
      field,
      value,
      document: ctx.evidenceDocument,
      contract,
      related: !contract.allowedFactFields.includes(fieldId),
    }));
  }

  return candidates;
}

function spanMatchesContract(span: EvidenceSpan, contract: EvidenceCheckContract): boolean {
  const text = contextText({ text: span.text, heading: span.heading, sectionPath: span.sectionPath });
  const positiveTerms = dedupe([
    ...contract.allowedAnchorTerms,
    ...contract.semanticTerms,
    ...contract.forbiddenAnchorTerms,
  ]);
  if (positiveTerms.some((term) => includesAny(text, [term]))) return true;

  const sourceType = classifyEvidenceSource({
    text: span.text,
    page: span.page,
    sectionPath: span.sectionPath,
    heading: span.heading,
    blockType: span.blockType,
    reliability: span.reliability,
    repeatedHeaderFooter: span.layout?.repeatedHeaderFooter,
  });
  return contract.allowedSourceTypes.includes(sourceType)
    && contract.semanticTerms.some((term) => includesAny(span.text, [term]));
}

function searchSections(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  if (!contract.searchTargets.includes("section")) return [];

  return ctx.evidenceDocument.spans
    .filter((span) => spanMatchesContract(span, contract))
    .map((span) => {
      const sourceType = classifyEvidenceSource({
        text: span.text,
        page: span.page,
        sectionPath: span.sectionPath,
        heading: span.heading,
        blockType: span.blockType,
        reliability: span.reliability,
        repeatedHeaderFooter: span.layout?.repeatedHeaderFooter,
      });
      return {
        text: span.text,
        quote: span.text,
        page: span.page,
        sectionPath: span.sectionPath,
        heading: span.heading,
        evidenceSpanIds: [span.spanId],
        source: `span:${span.spanId}`,
        sourceType,
        blockType: span.blockType,
        rank: sourceRank(sourceType, contract, span.blockType) + (isArtifactSpan(span) ? 0 : 20),
        warnings: span.reliability === "excluded" ? ["excluded_span"] : [],
      };
    });
}

function searchFromRouter(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  if (!contract.searchTargets.includes("router")) return [];
  const result = ctx.routerResult;
  if (!result.answerText.trim()) return [];
  if (/^Quick Check found no|could not build|multiple plausible/i.test(result.answerText)) return [];
  if (result.status === "no_evidence" && result.evidenceSpanIds.length === 0 && result.quotes.length === 0) return [];

  const lookup = spanById(ctx.evidenceDocument);
  const matchedSpans = result.evidenceSpanIds.map((id) => lookup.get(id)).filter((span): span is EvidenceSpan => Boolean(span));
  const primarySpan = matchedSpans[0];
  const sectionPath = primarySpan?.sectionPath ?? result.sectionPaths.flatMap((path) => path.split(/\s*>\s*/).filter(Boolean));
  const quote = result.quotes[0] ?? primarySpan?.text ?? result.answerText;
  const sourceType = primarySpan
    ? classifyEvidenceSource({
        text: primarySpan.text,
        page: primarySpan.page,
        sectionPath: primarySpan.sectionPath,
        heading: primarySpan.heading,
        blockType: primarySpan.blockType,
        reliability: primarySpan.reliability,
        repeatedHeaderFooter: primarySpan.layout?.repeatedHeaderFooter,
      })
    : classifyEvidenceSource({
        text: quote,
        page: result.pages[0] ?? null,
        sectionPath,
      });

  return [{
    text: result.answerText,
    quote,
    page: primarySpan?.page ?? result.pages[0] ?? null,
    sectionPath,
    heading: primarySpan?.heading,
    evidenceSpanIds: result.evidenceSpanIds,
    source: `router:${result.route}`,
    sourceType,
    sourceFactField: inferFactFieldFromAnswer(result.answerText) ?? undefined,
    blockType: primarySpan?.blockType,
    rank: 45 + sourceRank(sourceType, contract, primarySpan?.blockType),
    warnings: result.warnings,
  }];
}

function gatherCandidates(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  const all = [
    ...searchFactContract(contract, ctx),
    ...searchSections(contract, ctx),
    ...searchFromRouter(contract, ctx),
  ].sort((left, right) => right.rank - left.rank);

  const seen = new Set<string>();
  const deduped: CheckCandidate[] = [];
  for (const candidate of all) {
    const key = [
      candidate.sourceFactField ?? "",
      candidate.sourceType,
      normalizeText(candidate.text).slice(0, 120),
      candidate.evidenceSpanIds.join(","),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function hasGrounding(candidate: CheckCandidate): boolean {
  return (
    candidate.evidenceSpanIds.length > 0
    || candidate.page != null
    || candidate.sectionPath.length > 0
  ) && candidate.sourceType !== "structured_default_input";
}

function isHeadingOnly(candidate: CheckCandidate): boolean {
  const groundedQuote = candidate.quote.trim();
  if (
    candidate.evidenceSpanIds.length > 0
    && groundedQuote
    && normalizeText(groundedQuote) !== normalizeText(candidate.text)
    && wordCount(groundedQuote) > wordCount(candidate.text)
  ) {
    return false;
  }
  if (candidate.blockType === "section_heading" || candidate.blockType === "title") {
    const textWords = wordCount(candidate.text);
    if (textWords <= 8) return true;
  }
  const lastSection = candidate.sectionPath[candidate.sectionPath.length - 1] ?? candidate.heading ?? "";
  if (!lastSection) return false;
  return normalizeText(candidate.text) === normalizeText(lastSection) && wordCount(candidate.text) <= 8;
}

function isTemplateLabel(candidate: CheckCandidate): boolean {
  const text = candidate.text.trim();
  return (ARTIFACT_RE.test(text) || TEMPLATE_LABEL_RE.test(text)) && wordCount(text) <= 8;
}

function validateMismatchRules(contract: EvidenceCheckContract, candidate: CheckCandidate): CandidateValidation {
  const text = contextText({ text: candidate.text, heading: candidate.heading, sectionPath: candidate.sectionPath });

  if (
    contract.mismatchRules.includes("reject_artifact_or_default_input")
    && (
      candidate.sourceType === "page_header_footer_artifact"
      || candidate.sourceType === "structured_default_input"
      || candidate.extractionRule === "structured-input"
      || candidate.extractionRule?.endsWith(":family")
      || isTemplateLabel(candidate)
    )
  ) {
    return { valid: false, reason: "Evidence is an artifact, template label, or structured/default input rather than document-grounded evidence" };
  }

  if (contract.mismatchRules.includes("reject_heading_only") && contract.rejectHeadingOnly && isHeadingOnly(candidate)) {
    return { valid: false, reason: "Evidence is heading-only and has no substantive body content" };
  }

  if (
    contract.mismatchRules.includes("reject_reused_answer_from_other_check")
    && candidate.sourceFactField
    && !contract.allowedFactFields.includes(candidate.sourceFactField)
  ) {
    return { valid: false, reason: `Evidence belongs to ${candidate.sourceFactField}, not ${contract.checkId}` };
  }

  if (
    contract.mismatchRules.includes("reject_wrong_section_semantics")
    && !contract.allowedSourceTypes.includes(candidate.sourceType)
  ) {
    return { valid: false, reason: `Evidence source type ${candidate.sourceType} is not allowed for ${contract.checkId}` };
  }

  if (
    contract.mismatchRules.includes("reject_crediting_period_for_monitoring_period")
    && includesAny(text, ["crediting period", "project crediting", "ghg accounting period", "project lifetime", "accounting period"])
    && !includesAny(text, ["monitoring period", "reporting period", "verification period"])
  ) {
    return { valid: false, reason: "Crediting-period evidence cannot satisfy a monitoring-period check" };
  }

  if (
    contract.mismatchRules.includes("reject_monitoring_period_for_crediting_period")
    && includesAny(text, ["monitoring period", "reporting period", "verification period"])
    && !includesAny(text, ["crediting period", "project crediting", "ghg accounting period", "project lifetime", "accounting period"])
  ) {
    return { valid: false, reason: "Monitoring/reporting-period evidence cannot satisfy a crediting-period check" };
  }

  if (
    contract.mismatchRules.includes("reject_project_description_for_baseline_additionality_leakage")
    && ["baseline_scenario", "additionality", "leakage"].includes(contract.checkId)
    && ["project_summary", "project_details", "generic_body_text"].includes(candidate.sourceType)
  ) {
    return { valid: false, reason: "Generic project-description text cannot satisfy baseline/additionality/leakage checks" };
  }

  if (
    contract.mismatchRules.includes("reject_stakeholder_for_safeguards_unless_allowed")
    && contract.checkId === "safeguards"
    && includesAny(text, ["stakeholder", "consultation", "meeting"])
    && !includesAny(text, ["safeguard", "grievance", "fpic", "risk", "do no harm", "benefit sharing"])
  ) {
    return { valid: false, reason: "Stakeholder text lacks safeguard-specific evidence" };
  }

  if (
    contract.mismatchRules.includes("reject_location_without_country_for_host_country")
    && contract.checkId === "host_country"
    && candidate.sourceFactField !== "hostCountry"
    && candidate.sourceFactField !== "projectCountry"
    && !/\b(?:host country|host party|country\/area|country)\b/i.test(candidate.text)
  ) {
    return { valid: false, reason: "Location/subregion evidence does not contain a host-country value" };
  }

  if (
    contract.mismatchRules.includes("reject_methodology_modules_without_primary")
    && contract.checkId === "methodology"
    && (
      candidate.sourceFactField === "methodologyModules"
      || (includesAny(text, ["module", "tool"]) && !PRIMARY_METHODOLOGY_RE.test(candidate.text))
    )
  ) {
    return { valid: false, reason: "Methodology modules/tools cannot replace the primary methodology" };
  }

  return { valid: true, reason: "" };
}

function stripFactLabel(text: string): string {
  return text.replace(/^\s*[\w\s()/.-]{2,45}\s*[:\-]\s*/i, "").trim();
}

function validateCountryShape(candidate: CheckCandidate): CandidateValidation {
  const value = stripFactLabel(candidate.text).replace(/[.;]$/, "").trim();
  const wc = wordCount(value);
  if (candidate.sourceFactField === "projectLocation") {
    return { valid: false, reason: "Project location cannot satisfy host-country shape" };
  }
  if (wc < 1 || wc > 5) return { valid: false, reason: "Country answer must be a short country/host-party value" };
  if (/[;,]|\d|(?:province|district|municipality|region|latitude|longitude|coordinates?)/i.test(value)) {
    return { valid: false, reason: "Country answer contains location detail rather than only a country value" };
  }
  if (/\b(?:project|methodology|standard|version|period|section|table|page)\b/i.test(value)) {
    return { valid: false, reason: "Country answer contains non-country document text" };
  }
  return { valid: true, reason: "" };
}

function validateLocationShape(candidate: CheckCandidate): CandidateValidation {
  const value = stripFactLabel(candidate.text);
  const text = contextText({ text: candidate.text, heading: candidate.heading, sectionPath: candidate.sectionPath });
  const properNounCount = (value.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? []).length;
  const hasLocationLabel = /\b(?:project location|geographic(?:al)? (?:location|reference)|location|project site)\b/i.test(text);
  const hasLocativePhrase = /\b(?:located in|situated in|within|coordinates?|latitude|longitude)\b/i.test(text);
  const hasStructuredPlaceValue = /,/.test(value) || /\b\d+(?:\.\d+)?\b/.test(value) || properNounCount >= 2;
  const hasGeoTerms = /\b(?:site|region|district|province|regency|municipality|county|village|state|area|coordinates?|latitude|longitude|boundary|geographic)\b/i.test(text);
  const looksLikeBeneficiaryStatement = /\b(?:total of|included as|beneficiar|adjacent to|communit|villages?\s+adjacent|stakeholder|livelihood)\b/i.test(text);

  if (
    (candidate.sourceFactField === "hostCountry" || candidate.sourceFactField === "projectCountry")
    && wordCount(value) <= 5
  ) {
    return { valid: false, reason: "Country-only evidence cannot satisfy project-location shape" };
  }
  if (wordCount(value) < 2) return { valid: false, reason: "Location answer is too short" };
  if (!hasLocationLabel && !hasLocativePhrase && candidate.sourceFactField !== "projectLocation") {
    return { valid: false, reason: "Location evidence lacks an explicit location label or locative context" };
  }
  if (!hasStructuredPlaceValue && !(hasGeoTerms && properNounCount >= 1)) {
    return { valid: false, reason: "Location answer lacks location-specific detail" };
  }
  if (looksLikeBeneficiaryStatement && !hasLocationLabel && !hasLocativePhrase && !/,/.test(value)) {
    return { valid: false, reason: "Location evidence is a beneficiary/project-area statement, not a grounded location answer" };
  }
  return { valid: true, reason: "" };
}

function validateMethodologyShape(candidate: CheckCandidate): CandidateValidation {
  const text = candidate.text;
  if (!PRIMARY_METHODOLOGY_RE.test(text)) {
    return { valid: false, reason: "Methodology answer lacks a primary methodology code/version" };
  }
  if (/\b(?:module|tool)\b/i.test(text) && !/\b(?:methodology|methodological framework|VM|VCS|ACM|AMS|AR-ACM|AM|CDM|GS)\b/i.test(text)) {
    return { valid: false, reason: "Methodology answer only names modules/tools" };
  }
  return { valid: true, reason: "" };
}

function validateDateShape(candidate: CheckCandidate): CandidateValidation {
  const matches = candidate.text.match(DATE_TOKEN_RE) ?? [];
  if (matches.length < 1) return { valid: false, reason: "Date answer lacks a date value" };
  return { valid: true, reason: "" };
}

function validateDateRangeShape(candidate: CheckCandidate): CandidateValidation {
  const matches = candidate.text.match(DATE_TOKEN_RE) ?? [];
  const hasRangeTerm = /\b(?:to|through|until|from|between|-|–|—)\b/i.test(candidate.text);
  const hasDuration = /\b\d+\s*(?:year|month|day)s?\b/i.test(candidate.text);
  if (matches.length < 2 && !hasDuration) {
    return { valid: false, reason: "Date-range answer lacks two dates or a duration" };
  }
  if (matches.length >= 2 && !hasRangeTerm && !hasDuration) {
    return { valid: false, reason: "Date-range answer lacks range semantics" };
  }
  return { valid: true, reason: "" };
}

function validateProjectActivityShape(candidate: CheckCandidate): CandidateValidation {
  if (candidate.sourceFactField === "projectType" && wordCount(candidate.text) >= 1) return { valid: true, reason: "" };
  if (wordCount(candidate.text) < 4) return { valid: false, reason: "Project activity answer is too short" };
  if (!/\b(?:project activity|activity type|project type|afforestation|reforestation|revegetation|redd|renewable|energy|cookstove|forest|conservation|restoration|avoid(?:ed)? deforestation)\b/i.test(candidate.text)) {
    return { valid: false, reason: "Project activity answer lacks activity/type semantics" };
  }
  return { valid: true, reason: "" };
}

function validateNarrativeShape(contract: EvidenceCheckContract, candidate: CheckCandidate): CandidateValidation {
  if (wordCount(candidate.text) < contract.minimumEvidenceWords) {
    return { valid: false, reason: `Narrative evidence has fewer than ${contract.minimumEvidenceWords} words` };
  }
  if (contract.semanticTerms.length > 0 && !includesAny(contextText({
    text: candidate.text,
    heading: candidate.heading,
    sectionPath: candidate.sectionPath,
  }), contract.semanticTerms)) {
    return { valid: false, reason: "Narrative evidence lacks check-specific semantics" };
  }
  return { valid: true, reason: "" };
}

function validateBoundaryShape(contract: EvidenceCheckContract, candidate: CheckCandidate): CandidateValidation {
  const narrative = validateNarrativeShape(contract, candidate);
  if (!narrative.valid) return narrative;
  if (!/\b(?:boundary|reference region|leakage belt|baseline deforestation|carbon pool|carbon stock|project area|strata|buffer)\b/i.test(contextText({
    text: candidate.text,
    heading: candidate.heading,
    sectionPath: candidate.sectionPath,
  }))) {
    return { valid: false, reason: "Boundary/reference/leakage evidence lacks boundary-region semantics" };
  }
  return { valid: true, reason: "" };
}

function validateMonitoringPlanShape(candidate: CheckCandidate): CandidateValidation {
  const text = contextText({ text: candidate.text, heading: candidate.heading, sectionPath: candidate.sectionPath });
  if (wordCount(candidate.text) < 4) return { valid: false, reason: "Monitoring-plan evidence is too short" };
  if (!/\bmonitoring\b/i.test(text)) return { valid: false, reason: "Monitoring-plan evidence lacks monitoring semantics" };
  if (!/\b(?:plan|procedure|parameter|data|frequency|method|responsible|quality|qa|qc|measure|record)\b/i.test(text)) {
    return { valid: false, reason: "Monitoring-plan evidence lacks plan/procedure detail" };
  }
  return { valid: true, reason: "" };
}

function validateAnswerShape(contract: EvidenceCheckContract, candidate: CheckCandidate): CandidateValidation {
  switch (contract.expectedShape) {
    case "country":
      return validateCountryShape(candidate);
    case "location":
      return validateLocationShape(candidate);
    case "methodology_code_version":
      return validateMethodologyShape(candidate);
    case "date":
      return validateDateShape(candidate);
    case "date_range":
      return validateDateRangeShape(candidate);
    case "project_activity_type":
      return validateProjectActivityShape(candidate);
    case "boundary_reference_region_leakage_belt":
      return validateBoundaryShape(contract, candidate);
    case "monitoring_plan_evidence":
      return validateMonitoringPlanShape(candidate);
    case "narrative_explanation":
      return validateNarrativeShape(contract, candidate);
    default:
      return { valid: false, reason: "Unknown answer shape" };
  }
}

function validateCandidate(contract: EvidenceCheckContract, candidate: CheckCandidate): CandidateValidation {
  const mismatch = validateMismatchRules(contract, candidate);
  if (!mismatch.valid) return mismatch;

  const wc = wordCount(candidate.text);
  if (wc < contract.minimumEvidenceWords) {
    return { valid: false, reason: `Too few words (${wc} < ${contract.minimumEvidenceWords} required)` };
  }

  if (contract.requiresGroundedEvidence && !hasGrounding(candidate)) {
    return { valid: false, reason: "No page, section, or evidence span provenance" };
  }

  return validateAnswerShape(contract, candidate);
}

function resultFromCandidate(candidate: CheckCandidate): EvidenceCheckValidationResult {
  return {
    status: "found",
    answerText: compactText(candidate.text),
    downgradeReason: "",
    quotes: [compactText(candidate.quote, 800)].filter(Boolean),
    pages: dedupe([candidate.page].filter((page): page is number => page != null)).sort((left, right) => left - right),
    sections: candidate.sectionPath.length > 0 ? [candidate.sectionPath.join(" > ")] : [],
    evidenceSpanIds: dedupe(candidate.evidenceSpanIds),
    warnings: candidate.warnings,
  };
}

export function validateCheck(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
): EvidenceCheckValidationResult {
  const detectedFamily = detectContractDocumentFamily(ctx);
  if (!methodologyApplies(contract, ctx.methodologyId)) {
    return {
      status: "not_applicable",
      answerText: "",
      downgradeReason: `Check ${contract.checkId} does not apply to methodology ${ctx.methodologyId ?? "(unknown)"}.`,
      quotes: [],
      pages: [],
      sections: [],
      evidenceSpanIds: [],
      warnings: ["methodology_mismatch"],
    };
  }
  if (!documentFamilyApplies(contract, detectedFamily)) {
    return {
      status: "not_applicable",
      answerText: "",
      downgradeReason: `Check ${contract.checkId} does not apply to detected document family ${detectedFamily}.`,
      quotes: [],
      pages: [],
      sections: [],
      evidenceSpanIds: [],
      warnings: ["document_family_mismatch"],
    };
  }

  const candidates = gatherCandidates(contract, ctx);
  if (candidates.length === 0) {
    return {
      status: "missing",
      answerText: "",
      downgradeReason: `No candidate evidence found for ${contract.checkId}.`,
      quotes: [],
      pages: [],
      sections: [],
      evidenceSpanIds: [],
      warnings: ["no_candidate_evidence"],
    };
  }

  const rejected: string[] = [];
  for (const candidate of candidates) {
    const validation = validateCandidate(contract, candidate);
    if (validation.valid) return resultFromCandidate(candidate);
    rejected.push(`${candidate.source}: ${validation.reason}`);
  }

  return {
    status: "unclear",
    answerText: compactText(candidates[0]?.text ?? ""),
    downgradeReason: `Related evidence exists but failed contract validation: ${rejected[0] ?? "candidate rejected"}.`,
    quotes: [],
    pages: [],
    sections: [],
    evidenceSpanIds: [],
    warnings: dedupe(["contract_validation_failed", ...candidates.flatMap((candidate) => candidate.warnings)]),
  };
}

// -- Contract registry ------------------------------------------------------

function makeContract(input: Omit<EvidenceCheckContract, "mismatchRules" | "searchTargets" | "relatedFactFields"> & {
  mismatchRules?: EvidenceMismatchRuleId[];
  searchTargets?: SearchTarget[];
  relatedFactFields?: ProjectFactId[];
}): EvidenceCheckContract {
  return {
    ...input,
    searchTargets: input.searchTargets ?? ["fact_contract", "section", "router"],
    relatedFactFields: input.relatedFactFields ?? [],
    mismatchRules: dedupe([...COMMON_MISMATCH_RULES, ...(input.mismatchRules ?? [])]),
  };
}

const FACT_OR_PROJECT_SOURCE_TYPES: EvidenceSourceType[] = [
  "cover_title_block",
  "structured_fact_table",
  "project_summary",
  "project_details",
];

const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  project_activity: makeContract({
    checkId: "project_activity",
    applicableDocumentFamilies: ["any"],
    allowedSourceTypes: FACT_OR_PROJECT_SOURCE_TYPES,
    allowedAnchorTerms: ["project activity", "project description", "summary of project", "project type", "type of project activity"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline"],
    semanticTerms: ["project activity", "project type", "activity type", "afforestation", "reforestation", "revegetation", "redd", "energy", "forest", "conservation", "restoration"],
    allowedFactFields: ["projectType"],
    expectedShape: "project_activity_type",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  }),
  host_country: makeContract({
    checkId: "host_country",
    applicableDocumentFamilies: ["any"],
    allowedSourceTypes: FACT_OR_PROJECT_SOURCE_TYPES,
    allowedAnchorTerms: ["host country", "country/area", "country", "host party"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    semanticTerms: ["host country", "country/area", "country", "host party"],
    allowedFactFields: ["hostCountry", "projectCountry"],
    relatedFactFields: ["projectLocation"],
    expectedShape: "country",
    mismatchRules: ["reject_location_without_country_for_host_country"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  }),
  project_location: makeContract({
    checkId: "project_location",
    applicableDocumentFamilies: ["any"],
    allowedSourceTypes: FACT_OR_PROJECT_SOURCE_TYPES,
    allowedAnchorTerms: ["project location", "location", "site", "geographic reference", "geographic location"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    semanticTerms: ["project location", "location", "site", "geographic", "coordinates", "region", "district", "province"],
    allowedFactFields: ["projectLocation"],
    relatedFactFields: ["hostCountry", "projectCountry"],
    expectedShape: "location",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  }),
  methodology: makeContract({
    checkId: "methodology",
    applicableDocumentFamilies: ["any"],
    allowedSourceTypes: ["cover_title_block", "structured_fact_table", "methodology_section"],
    allowedAnchorTerms: ["methodology", "application of methodology", "applied methodology", "title and reference"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "participant"],
    semanticTerms: ["methodology", "methodological framework", "approved baseline and monitoring methodology", "title and reference"],
    allowedFactFields: ["methodologyPrimary"],
    relatedFactFields: ["methodologyModules", "baselineMethodology", "monitoringMethodology"],
    expectedShape: "methodology_code_version",
    mismatchRules: ["reject_methodology_modules_without_primary"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  }),
  crediting_period: makeContract({
    checkId: "crediting_period",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["cover_title_block", "structured_fact_table", "project_details"],
    allowedAnchorTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "comments"],
    semanticTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"],
    allowedFactFields: ["creditingPeriod"],
    relatedFactFields: ["monitoringPeriod", "reportingPeriod"],
    expectedShape: "date_range",
    mismatchRules: ["reject_monitoring_period_for_crediting_period"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  }),
  monitoring_period: makeContract({
    checkId: "monitoring_period",
    applicableDocumentFamilies: ["validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["cover_title_block", "structured_fact_table", "monitoring_section", "project_details"],
    allowedAnchorTerms: ["monitoring period", "reporting period", "verification period", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["monitoring period", "reporting period", "verification period"],
    allowedFactFields: ["monitoringPeriod", "reportingPeriod"],
    relatedFactFields: ["creditingPeriod"],
    expectedShape: "date_range",
    mismatchRules: ["reject_crediting_period_for_monitoring_period"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  }),
  baseline_scenario: makeContract({
    checkId: "baseline_scenario",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report"],
    allowedSourceTypes: ["baseline_section"],
    allowedAnchorTerms: ["baseline", "without project", "without-project", "baseline scenario"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "contact"],
    semanticTerms: ["baseline", "without project", "without-project", "baseline scenario", "land use scenario"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    mismatchRules: ["reject_project_description_for_baseline_additionality_leakage"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  additionality: makeContract({
    checkId: "additionality",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report"],
    allowedSourceTypes: ["additionality_section", "baseline_section"],
    allowedAnchorTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    mismatchRules: ["reject_project_description_for_baseline_additionality_leakage"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  leakage: makeContract({
    checkId: "leakage",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["leakage_section"],
    allowedAnchorTerms: ["leakage", "activity shifting"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["leakage", "activity shifting", "leakage emissions", "leakage belt"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    mismatchRules: ["reject_project_description_for_baseline_additionality_leakage"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  safeguards: makeContract({
    checkId: "safeguards",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["safeguard_stakeholder_environment_section"],
    allowedAnchorTerms: ["safeguard", "grievance", "fpic", "do no harm", "risk"],
    forbiddenAnchorTerms: [],
    semanticTerms: ["safeguard", "grievance", "fpic", "do no harm", "risk", "benefit sharing"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    mismatchRules: ["reject_stakeholder_for_safeguards_unless_allowed"],
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  environmental_impacts: makeContract({
    checkId: "environmental_impacts",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["safeguard_stakeholder_environment_section"],
    allowedAnchorTerms: ["environmental impact", "environmental", "impact assessment"],
    forbiddenAnchorTerms: [],
    semanticTerms: ["environmental impact", "environmental", "impact assessment", "biodiversity", "habitat", "soil", "water"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  stakeholder_consultation: makeContract({
    checkId: "stakeholder_consultation",
    applicableDocumentFamilies: ["pdd", "validation_report", "verification_report", "monitoring_report"],
    allowedSourceTypes: ["safeguard_stakeholder_environment_section"],
    allowedAnchorTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "stakeholder participation", "community meeting"],
    forbiddenAnchorTerms: [],
    semanticTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "community meeting", "public comment"],
    allowedFactFields: [],
    expectedShape: "narrative_explanation",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  vm0007_boundary: makeContract({
    checkId: "vm0007_boundary",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["project_details", "baseline_section", "leakage_section"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["project boundary", "boundary", "project area", "strata"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  vm0007_leakage_belt: makeContract({
    checkId: "vm0007_leakage_belt",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["leakage_section"],
    allowedAnchorTerms: ["leakage belt"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["leakage belt", "buffer", "activity shifting"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  }),
  vm0007_reference_region: makeContract({
    checkId: "vm0007_reference_region",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["baseline_section", "project_details"],
    allowedAnchorTerms: ["reference region"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["reference region", "reference area", "region"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  }),
  vm0007_baseline_deforestation: makeContract({
    checkId: "vm0007_baseline_deforestation",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["baseline_section"],
    allowedAnchorTerms: ["baseline deforestation", "deforestation", "degradation"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["baseline deforestation", "deforestation", "degradation", "forest loss"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  vm0007_carbon_pools: makeContract({
    checkId: "vm0007_carbon_pools",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["baseline_section", "project_details"],
    allowedAnchorTerms: ["carbon pool", "carbon stock"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  }),
  vm0007_monitoring_plan: makeContract({
    checkId: "vm0007_monitoring_plan",
    applicableDocumentFamilies: ["pdd", "validation_report", "monitoring_report", "verification_report"],
    applicableMethodologies: ["VM0007"],
    allowedSourceTypes: ["monitoring_section"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["monitoring plan", "monitoring", "data", "parameter", "frequency", "procedure"],
    allowedFactFields: [],
    expectedShape: "monitoring_plan_evidence",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  ar_acm0003_arr_activity: makeContract({
    checkId: "ar_acm0003_arr_activity",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["AR-ACM0003"],
    allowedSourceTypes: FACT_OR_PROJECT_SOURCE_TYPES,
    allowedAnchorTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"],
    allowedFactFields: ["projectType"],
    expectedShape: "project_activity_type",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  }),
  ar_acm0003_boundary: makeContract({
    checkId: "ar_acm0003_boundary",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["AR-ACM0003"],
    allowedSourceTypes: ["project_details"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["project boundary", "boundary", "project area", "strata"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
  ar_acm0003_carbon_pools: makeContract({
    checkId: "ar_acm0003_carbon_pools",
    applicableDocumentFamilies: ["pdd", "validation_report"],
    applicableMethodologies: ["AR-ACM0003"],
    allowedSourceTypes: ["project_details"],
    allowedAnchorTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"],
    allowedFactFields: [],
    expectedShape: "boundary_reference_region_leakage_belt",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  }),
  ar_acm0003_monitoring_plan: makeContract({
    checkId: "ar_acm0003_monitoring_plan",
    applicableDocumentFamilies: ["pdd", "validation_report", "monitoring_report", "verification_report"],
    applicableMethodologies: ["AR-ACM0003"],
    allowedSourceTypes: ["monitoring_section"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    semanticTerms: ["monitoring plan", "monitoring", "data", "parameter", "frequency", "procedure"],
    allowedFactFields: [],
    expectedShape: "monitoring_plan_evidence",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  }),
};

// -- Check definitions ------------------------------------------------------

const UNIVERSAL_CHECKS: EvidenceCheck[] = [
  { id: "project_activity", label: "Project activity", question: "What is the project activity?" },
  { id: "host_country", label: "Host country", question: "What is the host country?" },
  { id: "project_location", label: "Project location", question: "What is the project location?" },
  { id: "methodology", label: "Methodology", question: "What methodology was applied?" },
  { id: "crediting_period", label: "Crediting period", question: "What is the crediting period?" },
  { id: "monitoring_period", label: "Monitoring period", question: "What is the monitoring period?" },
  { id: "baseline_scenario", label: "Baseline scenario", question: "What is the baseline scenario?" },
  { id: "additionality", label: "Additionality", question: "What does the document say about additionality?" },
  { id: "leakage", label: "Leakage", question: "What does the document say about leakage?" },
  { id: "safeguards", label: "Safeguards", question: "What does the document say about safeguards?" },
  { id: "environmental_impacts", label: "Environmental impacts", question: "What does the document say about environmental impacts?" },
  { id: "stakeholder_consultation", label: "Stakeholder consultation", question: "What does the document say about stakeholder consultation?" },
];

const VM0007_CHECKS: EvidenceCheck[] = [
  { id: "vm0007_boundary", label: "Project boundary", question: "What does the document say about the project boundary?", methodologySpecific: "VM0007" },
  { id: "vm0007_leakage_belt", label: "Leakage belt", question: "What does the document say about the leakage belt?", methodologySpecific: "VM0007" },
  { id: "vm0007_reference_region", label: "Reference region", question: "What does the document say about the reference region?", methodologySpecific: "VM0007" },
  { id: "vm0007_baseline_deforestation", label: "Baseline deforestation", question: "What does the document say about baseline deforestation?", methodologySpecific: "VM0007" },
  { id: "vm0007_carbon_pools", label: "Carbon pools", question: "What does the document say about carbon pools?", methodologySpecific: "VM0007" },
  { id: "vm0007_monitoring_plan", label: "Monitoring plan", question: "What does the document say about the monitoring plan?", methodologySpecific: "VM0007" },
];

const AR_ACM0003_CHECKS: EvidenceCheck[] = [
  { id: "ar_acm0003_arr_activity", label: "ARR activity type", question: "What type of ARR activity is described?", methodologySpecific: "AR-ACM0003" },
  { id: "ar_acm0003_boundary", label: "Project boundary", question: "What does the document say about the project boundary?", methodologySpecific: "AR-ACM0003" },
  { id: "ar_acm0003_carbon_pools", label: "Carbon pools", question: "What does the document say about carbon pools?", methodologySpecific: "AR-ACM0003" },
  { id: "ar_acm0003_monitoring_plan", label: "Monitoring plan", question: "What does the document say about the monitoring plan?", methodologySpecific: "AR-ACM0003" },
];

export function getContract(checkId: EvidenceCheckId): EvidenceCheckContract {
  return CONTRACTS[checkId];
}

export function getUniversalChecks(): EvidenceCheck[] {
  return UNIVERSAL_CHECKS;
}

export function getMethodologyChecks(methodologyId: string): EvidenceCheck[] {
  const normalized = methodologyId.trim().toUpperCase();
  if (normalized === "VM0007") return VM0007_CHECKS;
  if (normalized === "AR-ACM0003") return AR_ACM0003_CHECKS;
  return [];
}

export function getAllChecks(methodologyId?: string): EvidenceCheck[] {
  const checks = [...UNIVERSAL_CHECKS];
  if (methodologyId) checks.push(...getMethodologyChecks(methodologyId));
  return checks;
}

export function statusFromRouter(
  routerStatus: "answered" | "unclear" | "no_evidence",
): EvidenceCheckStatus {
  switch (routerStatus) {
    case "answered": return "found";
    case "no_evidence": return "missing";
    default: return "unclear";
  }
}
