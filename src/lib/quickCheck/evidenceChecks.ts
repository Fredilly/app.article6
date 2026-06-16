/**
 * Evidence Checks — per-check contracts with candidate search and validation.
 */

import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { ProjectFactContract, ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";

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

export type DocumentFamilyFilter = "PDD" | "validation_report" | "verification_report" | "monitoring_report" | "any";

type SearchTarget = "fact_contract" | "section" | "body_text";

export type EvidenceCheckContract = {
  applicableDocumentFamilies: DocumentFamilyFilter[];
  searchTargets: SearchTarget[];
  allowedAnchorTerms: string[];
  forbiddenAnchorTerms: string[];
  allowedFactFields: string[];
  expectedShape: string;
  requiresGroundedEvidence: boolean;
  minimumEvidenceWords: number;
  rejectHeadingOnly: boolean;
};

export type CheckValidationContext = {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
  routerResult: DeterministicRouterResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
};

type CheckCandidate = {
  text: string;
  page: number | null;
  sectionPath: string[];
  heading?: string;
  evidenceSpanId?: string;
  source: string;
  rank: number;
};

export function formatEvidenceCheckUiText(input: {
  label: string;
  status: EvidenceCheckStatus;
  answerText: string;
  downgradeReason: string;
}): { answerText: string; downgradeReason: string } {
  const topic = input.label.trim().toLowerCase();
  const fallbackUnclear = `Quick Check found a possible mention of ${topic}, but it was not specific enough to confirm.`;

  if (input.status === "missing") {
    return {
      answerText: `Quick Check did not find a clear ${topic} in the uploaded document.`,
      downgradeReason: "",
    };
  }

  if (input.status !== "unclear") {
    return {
      answerText: input.answerText,
      downgradeReason: input.downgradeReason,
    };
  }

  let downgradeReason = input.downgradeReason.trim();
  if (/Too few words/i.test(downgradeReason)) {
    downgradeReason = "The mention was too short to rely on.";
  } else if (/Heading-only echo/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a heading, but not enough body text to confirm it.";
  } else if (/No page, section, or evidence span provenance/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it did not preserve enough source context to confirm it.";
  } else if (/Evidence from a forbidden section/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it came from a section that does not answer this topic directly.";
  } else if (/Too many words for a country name|Contains punctuation|Contains standard\/methodology text/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it did not read like a specific country value.";
  } else if (/Best candidate rejected:/i.test(downgradeReason)) {
    downgradeReason = fallbackUnclear;
  }

  return {
    answerText: input.answerText?.trim() || fallbackUnclear,
    downgradeReason,
  };
}

function normalizeAnchor(t: string): string { return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(); }
function anchorMatches(path: string[], terms: string[]): boolean { const lower = path.join(" > ").toLowerCase(); return terms.some((t) => lower.includes(normalizeAnchor(t))); }
function anchorForbidden(path: string[], terms: string[]): boolean { return terms.length > 0 && anchorMatches(path, terms); }
function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length; }
function formatFactValue(value: unknown): string | null { if (Array.isArray(value)) return value.filter(Boolean).join(", ") || null; if (typeof value === "string") return value.trim() || null; return null; }

function searchFactContract(contract: EvidenceCheckContract, factContract: ProjectFactContract): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const contractRecord = factContract as unknown as Record<string, ProjectFactField | undefined>;
  for (const fieldId of contract.allowedFactFields) {
    const field = contractRecord[fieldId];
    if (!field?.value) continue;
    const value = formatFactValue(field.value);
    if (!value) continue;
    candidates.push({ text: value, page: field.pageNumbers[0] ?? null, sectionPath: field.sectionPath, heading: field.heading, evidenceSpanId: field.evidenceSpanIds[0], source: `fact:${fieldId}`, rank: field.evidenceSpanIds.length > 0 || field.sectionPath.length > 0 ? 100 : 60 });
  }
  return candidates;
}

function searchSections(contract: EvidenceCheckContract, evidenceDocument: EvidenceDocument): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const allowedLower = contract.allowedAnchorTerms.map(normalizeAnchor);
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);
  for (const span of evidenceDocument.spans) {
    if (span.reliability === "excluded") continue;
    if (span.text.trim().length < contract.minimumEvidenceWords * 3) continue;
    const hasSectionContext = Boolean(span.heading) || span.sectionPath.length > 0 || Boolean(span.sectionId);
    if (!hasSectionContext) continue;
    const trimmed = span.text.trim();
    if (/^(?:CCB|VCS|VERRA)\s*(?:&|and)?\s*(?:VCS|CCB)?\s*(?:PROJECT|VERSION|v\d)/i.test(trimmed)) continue;
    if (/^(?:CCB|VCS)\s+(?:Version|v)\s*\d/i.test(trimmed)) continue;
    if (/^(?:Page\s+\d+|v\d+\.\d+|VALIDATION REPORT|VERIFICATION REPORT)/i.test(trimmed)) continue;
    if (/^(?:CCB|VCS|VERRA)\s*(?:&|and)?\s*(?:VCS|CCB)?\s*(?:VERIFICATION|VALIDATION)\s*(?:REPORT)?/i.test(trimmed)) continue;
    const headingText = (span.heading ?? "").toLowerCase();
    const sectionLower = span.sectionPath.join(" > ").toLowerCase();
    if (forbiddenLower.some((t) => sectionLower.includes(t))) continue;
    const isBodyText = ["paragraph", "field", "formula"].includes(span.blockType);
    const isHeading = span.blockType === "section_heading";
    let rank = 0;
    if (allowedLower.length > 0 && allowedLower.some((t) => headingText.includes(t))) { rank = isBodyText ? 90 : 70; }
    else if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) { rank = isBodyText ? 60 : 50; }
    else if (allowedLower.length === 0 && isBodyText && !isHeading) { rank = 20; }
    if (rank === 0) continue;
    candidates.push({ text: span.text, page: span.page, sectionPath: span.sectionPath, heading: span.heading, evidenceSpanId: span.spanId, source: `span:${span.spanId}`, rank });
  }
  return candidates;
}

function searchFromRouter(routerResult: DeterministicRouterResult, contract: EvidenceCheckContract): CheckCandidate[] {
  if (routerResult.status !== "answered" || !routerResult.answerText || routerResult.answerText.startsWith("Quick Check found no")) return [];
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);
  const sectionLower = routerResult.sectionPaths.join(" > ").toLowerCase();
  if (forbiddenLower.some((t) => sectionLower.includes(t))) return [];
  const allowedLower = contract.allowedAnchorTerms.map(normalizeAnchor);
  let rank = 30;
  if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) rank = 80;
  const hasGrounded = routerResult.quotes.length > 0 || routerResult.pages.length > 0 || routerResult.sectionPaths.length > 0 || routerResult.evidenceSpanIds.length > 0;
  if (!hasGrounded) rank = Math.min(rank, 40);
  return [{ text: routerResult.answerText, page: routerResult.pages[0] ?? null, sectionPath: routerResult.sectionPaths, heading: undefined, evidenceSpanId: routerResult.evidenceSpanIds[0], source: `router:${routerResult.route}`, rank }];
}

function gatherCandidates(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  const all: CheckCandidate[] = [];
  for (const target of contract.searchTargets) {
    if (target === "fact_contract") all.push(...searchFactContract(contract, ctx.projectFactContract));
    else if (target === "section") all.push(...searchSections(contract, ctx.evidenceDocument));
  }
  all.push(...searchFromRouter(ctx.routerResult, contract));
  const seen = new Set<string>();
  const deduped: CheckCandidate[] = [];
  for (const c of all.sort((a, b) => b.rank - a.rank)) {
    const key = c.text.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return deduped;
}

function validateCandidate(contract: EvidenceCheckContract, candidate: CheckCandidate): { valid: boolean; reason: string } {
  const wc = wordCount(candidate.text);
  if (wc < contract.minimumEvidenceWords) return { valid: false, reason: `Too few words (${wc} < ${contract.minimumEvidenceWords} required)` };
  if (contract.rejectHeadingOnly && candidate.sectionPath.length > 0) {
    const lastSection = candidate.sectionPath[candidate.sectionPath.length - 1] ?? "";
    const textLower = candidate.text.slice(0, 60).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const sectionLower = lastSection.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (textLower === sectionLower && wc <= 5) return { valid: false, reason: "Heading-only echo — no substantive body content" };
  }
  if (contract.requiresGroundedEvidence) {
    const hasProvenance = candidate.page != null || candidate.sectionPath.length > 0 || candidate.evidenceSpanId != null;
    if (!hasProvenance) return { valid: false, reason: "No page, section, or evidence span provenance" };
  }
  if (contract.forbiddenAnchorTerms.length > 0 && candidate.sectionPath.length > 0) {
    if (anchorForbidden(candidate.sectionPath, contract.forbiddenAnchorTerms)) return { valid: false, reason: "Evidence from a forbidden section" };
  }
  if (contract.expectedShape === "country") {
    if (wc > 5) return { valid: false, reason: "Too many words for a country name" };
    if (/:|;|\(|\)/.test(candidate.text)) return { valid: false, reason: "Contains punctuation (not a country name)" };
    if (/\b(?:standard|methodology|version|requirements?|project)\b/i.test(candidate.text)) return { valid: false, reason: "Contains standard/methodology text, not a country name" };
  }
  return { valid: true, reason: "" };
}

export function validateCheck(contract: EvidenceCheckContract, ctx: CheckValidationContext): { status: EvidenceCheckStatus; answerText: string; downgradeReason: string } {
  const candidates = gatherCandidates(contract, ctx);
  if (candidates.length === 0) {
    return { status: "missing", answerText: "", downgradeReason: "" };
  }
  for (const candidate of candidates) {
    const validation = validateCandidate(contract, candidate);
    if (validation.valid) {
      const truncated = candidate.text.length > 500 ? candidate.text.slice(0, 500).replace(/\s+\S*$/, "") + "\u2026" : candidate.text;
      return { status: "found", answerText: truncated, downgradeReason: "" };
    }
  }
  const bestFailed = validateCandidate(contract, candidates[0]);
  return { status: "unclear", answerText: candidates[0].text, downgradeReason: bestFailed.reason };
}

// ── Contracts ──────────────────────────────────────────────────────────────
const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  project_activity: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["project activity", "project description", "summary of project", "project type", "project goals", "project design"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline"], allowedFactFields: ["projectType"], expectedShape: "project_activity_description", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  host_country: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["host country", "country"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"], allowedFactFields: ["hostCountry", "projectCountry"], expectedShape: "country", requiresGroundedEvidence: true, minimumEvidenceWords: 1, rejectHeadingOnly: true },
  project_location: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["project location", "location", "project area", "site"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"], allowedFactFields: ["projectLocation"], expectedShape: "location", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true },
  methodology: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["methodology", "application of methodology", "applied methodology", "title and reference"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "participant"], allowedFactFields: ["methodologyPrimary", "methodologyModules"], expectedShape: "methodology_name_version", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true },
  crediting_period: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "comments"], allowedFactFields: ["creditingPeriod"], expectedShape: "date_range_with_duration", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true },
  monitoring_period: { applicableDocumentFamilies: ["verification_report", "monitoring_report", "validation_report"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["monitoring period", "reporting period", "verification period", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: ["monitoringPeriod", "reportingPeriod"], expectedShape: "date_range", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true },
  baseline_scenario: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["baseline", "without project", "without-project"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "contact"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  additionality: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  leakage: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["leakage", "activity shifting"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  safeguards: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["safeguard", "grievance", "fpic"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  environmental_impacts: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["environmental impact", "environmental", "impact assessment"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  stakeholder_consultation: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "stakeholder participation", "community meeting"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  vm0007_boundary: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["project boundary", "boundary"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  vm0007_leakage_belt: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["leakage belt"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true },
  vm0007_reference_region: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["reference region"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true },
  vm0007_baseline_deforestation: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["baseline deforestation", "deforestation", "degradation"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  vm0007_carbon_pools: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["carbon pool", "carbon stock"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true },
  vm0007_monitoring_plan: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["monitoring plan", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  ar_acm0003_arr_activity: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: ["projectType"], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true },
  ar_acm0003_boundary: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["project boundary", "boundary"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
  ar_acm0003_carbon_pools: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true },
  ar_acm0003_monitoring_plan: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["monitoring plan", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true },
};

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

export function getContract(checkId: EvidenceCheckId): EvidenceCheckContract { return CONTRACTS[checkId]; }
export function getUniversalChecks(): EvidenceCheck[] { return UNIVERSAL_CHECKS; }
export function getAllChecks(_methodologyId?: string): EvidenceCheck[] { void _methodologyId; return UNIVERSAL_CHECKS; }
export function statusFromRouter(routerStatus: "answered" | "unclear" | "no_evidence"): EvidenceCheckStatus { switch (routerStatus) { case "answered": return "found"; case "no_evidence": return "missing"; default: return "unclear"; } }
