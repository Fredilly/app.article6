/**
 * Evidence Checks — per-check contracts with candidate search, ranking,
 * validation, and answer shaping.
 *
 * Architecture:
 *   Router retrieves broadly.
 *   Contract searches → ranks → validates → shapes.
 *   UI displays only contract-approved results.
 */

import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { ProjectFactContract, ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Contract types ─────────────────────────────────────────────────────────

export type DocumentFamilyFilter = "PDD" | "validation_report" | "verification_report" | "monitoring_report" | "any";

/**
 * Where a contract searches for evidence first.
 */
type SearchTarget = "fact_contract" | "section" | "body_text";

/**
 * Full check contract.  Controls the entire check lifecycle.
 */
export type EvidenceCheckContract = {
  applicableDocumentFamilies: DocumentFamilyFilter[];

  // ── Candidate search ───────────────────────────────────────────────
  /** Ordered search targets.  Earlier = higher priority. */
  searchTargets: SearchTarget[];
  /** Section heading terms that qualify as valid evidence anchors. */
  allowedAnchorTerms: string[];
  /** Section heading terms that automatically reject evidence. */
  forbiddenAnchorTerms: string[];
  /** Fact fields that qualify as evidence for fact-contract searches. */
  allowedFactFields: string[];

  // ── Validation ─────────────────────────────────────────────────────
  expectedShape: string;
  requiresGroundedEvidence: boolean;
  minimumEvidenceWords: number;
  rejectHeadingOnly: boolean;
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

// ── Structured context passed in from QuickCheckPanel ──────────────────────

export type CheckValidationContext = {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
  routerResult: DeterministicRouterResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeAnchor(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function anchorMatches(path: string[], terms: string[]): boolean {
  if (terms.length === 0) return true;
  const lower = path.join(" > ").toLowerCase();
  return terms.some((t) => lower.includes(normalizeAnchor(t)));
}

function anchorForbidden(path: string[], terms: string[]): boolean {
  if (terms.length === 0) return false;
  return anchorMatches(path, terms);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatFactValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || null;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function searchFactContract(
  contract: EvidenceCheckContract,
  factContract: ProjectFactContract,
): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const contractRecord = factContract as unknown as Record<string, ProjectFactField | undefined>;
  for (const fieldId of contract.allowedFactFields) {
    const field = contractRecord[fieldId];
    if (!field?.value) continue;
    const value = formatFactValue(field.value);
    if (!value) continue;
    const isGrounded = field.evidenceSpanIds.length > 0 || field.sectionPath.length > 0;
    const hasPage = field.pageNumbers.length > 0;
    candidates.push({
      text: value,
      page: hasPage ? field.pageNumbers[0] ?? null : null,
      sectionPath: field.sectionPath,
      heading: field.heading,
      evidenceSpanId: field.evidenceSpanIds[0],
      source: `fact:${fieldId}`,
      rank: isGrounded ? 100 : 60,
    });
  }
  return candidates;
}

function searchSections(
  contract: EvidenceCheckContract,
  evidenceDocument: EvidenceDocument,
): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const allowedLower = contract.allowedAnchorTerms.map(normalizeAnchor);
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);

  for (const span of evidenceDocument.spans) {
    if (span.reliability === "excluded") continue;
    if (span.text.trim().length < contract.minimumEvidenceWords * 3) continue;

    // ── Exclude root-level PDF artifacts ──────────────────────────────
    // Spans with no heading, no section path, and no section ID are
    // cover-page branding, page headers, or stray PDF artifacts.
    const hasSectionContext = Boolean(span.heading)
      || span.sectionPath.length > 0
      || Boolean(span.sectionId);
    if (!hasSectionContext) continue;

    // ── Exclude noise patterns ────────────────────────────────────────
    const trimmed = span.text.trim();
    if (/^(?:CCB|VCS|VERRA)\s*(?:&|and)?\s*(?:VCS|CCB)?\s*(?:PROJECT|VERSION|v\d)/i.test(trimmed)) continue;
    if (/^(?:CCB|VCS)\s+(?:Version|v)\s*\d/i.test(trimmed)) continue;
    if (/^(?:Page\s+\d+|v\d+\.\d+|VALIDATION REPORT|VERIFICATION REPORT)/i.test(trimmed)) continue;

    const headingText = (span.heading ?? "").toLowerCase();
    const sectionLower = span.sectionPath.join(" > ").toLowerCase();

    // Skip spans clearly from forbidden sections
    if (forbiddenLower.some((t) => sectionLower.includes(t))) continue;

    // Body text spans (paragraph, field, formula) are preferred
    const isBodyText = ["paragraph", "field", "formula"].includes(span.blockType);
    const isHeading = span.blockType === "section_heading";

    let rank = 0;
    if (allowedLower.length > 0 && allowedLower.some((t) => headingText.includes(t))) {
      rank = isBodyText ? 90 : 70;
    } else if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) {
      rank = isBodyText ? 60 : 50;
    } else if (allowedLower.length === 0 && isBodyText && !isHeading) {
      // Only fall back to generic body text when NO specific anchors
      // are required.  When anchors are defined, only matching spans
      // qualify — prevents generic text from filling checks like
      // baseline_scenario when the document has no baseline section.
      rank = 20;
    }
    if (rank === 0) continue;

    candidates.push({
      text: span.text,
      page: span.page,
      sectionPath: span.sectionPath,
      heading: span.heading,
      evidenceSpanId: span.spanId,
      source: `span:${span.spanId}`,
      rank,
    });
  }

  return candidates;
}

function searchFromRouter(
  routerResult: DeterministicRouterResult,
  contract: EvidenceCheckContract,
): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  if (routerResult.status !== "answered") return candidates;
  if (!routerResult.answerText || routerResult.answerText.startsWith("Quick Check found no")) return candidates;

  const allowedLower = contract.allowedAnchorTerms.map(normalizeAnchor);
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);
  const sectionLower = routerResult.sectionPaths.join(" > ").toLowerCase();

  if (forbiddenLower.some((t) => sectionLower.includes(t))) return candidates;

  let rank = 30;
  if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) {
    rank = 80;
  }

  const hasGrounded = routerResult.quotes.length > 0
    || routerResult.pages.length > 0
    || routerResult.sectionPaths.length > 0
    || routerResult.evidenceSpanIds.length > 0;
  if (!hasGrounded) rank = Math.min(rank, 40);

  candidates.push({
    text: routerResult.answerText,
    page: routerResult.pages[0] ?? null,
    sectionPath: routerResult.sectionPaths,
    heading: undefined,
    evidenceSpanId: routerResult.evidenceSpanIds[0],
    source: `router:${routerResult.route}`,
    rank,
  });

  return candidates;
}

// ── Candidate ranking ─────────────────────────────────────────────────────

function gatherCandidates(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
): CheckCandidate[] {
  const all: CheckCandidate[] = [];

  for (const target of contract.searchTargets) {
    switch (target) {
      case "fact_contract":
        all.push(...searchFactContract(contract, ctx.projectFactContract));
        break;
      case "section":
        all.push(...searchSections(contract, ctx.evidenceDocument));
        break;
      case "body_text":
        break;
    }
  }

  // Router result as fallback
  all.push(...searchFromRouter(ctx.routerResult, contract));

  // Deduplicate by text prefix and sort by rank desc
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

// ── Validation ─────────────────────────────────────────────────────────────

function validateCandidate(
  contract: EvidenceCheckContract,
  candidate: CheckCandidate,
): { valid: boolean; reason: string } {
  const wc = wordCount(candidate.text);

  // Minimum content
  if (wc < contract.minimumEvidenceWords) {
    return { valid: false, reason: `Too few words (${wc} < ${contract.minimumEvidenceWords} required)` };
  }

  // Heading-only checks
  if (contract.rejectHeadingOnly && candidate.sectionPath.length > 0) {
    const lastSection = candidate.sectionPath[candidate.sectionPath.length - 1] ?? "";
    const textLower = candidate.text.slice(0, 60).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const sectionLower = lastSection.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (textLower === sectionLower && wc <= 5) {
      return { valid: false, reason: "Heading-only echo — no substantive body content" };
    }
  }

  // Must have some provenance
  if (contract.requiresGroundedEvidence) {
    const hasProvenance = candidate.page != null
      || candidate.sectionPath.length > 0
      || candidate.evidenceSpanId != null;
    if (!hasProvenance) {
      return { valid: false, reason: "No page, section, or evidence span provenance" };
    }
  }

  // Must not be from forbidden sections
  if (contract.forbiddenAnchorTerms.length > 0 && candidate.sectionPath.length > 0) {
    const forbidden = contract.forbiddenAnchorTerms;
    if (anchorForbidden(candidate.sectionPath, forbidden)) {
      return { valid: false, reason: "Evidence from a forbidden section" };
    }
  }

  // ── Shape validation ────────────────────────────────────────────────
  if (contract.expectedShape === "country") {
    // Must look like a country name: 1-4 words, no colons, no standard refs
    if (wc > 5) return { valid: false, reason: "Too many words for a country name" };
    if (/:|;|\(|\)/.test(candidate.text)) return { valid: false, reason: "Contains punctuation (not a country name)" };
    if (/\b(?:standard|methodology|version|requirements?|project)\b/i.test(candidate.text)) {
      return { valid: false, reason: "Contains standard/methodology text, not a country name" };
    }
  }

  return { valid: true, reason: "" };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function validateCheck(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
): { status: EvidenceCheckStatus; answerText: string; downgradeReason: string } {
  const route = ctx.routerResult.route;

  // ── Not applicable ──────────────────────────────────────────────────
  if (!contract.applicableDocumentFamilies.includes("any")) {
    // For now, all checks are universal.  This can be tightened later
    // with document family detection from evidenceDocument.documentFamily.
  }

  // ── Search + rank ───────────────────────────────────────────────────
  const candidates = gatherCandidates(contract, ctx);

  if (candidates.length === 0) {
    return {
      status: "missing",
      answerText: "",
      downgradeReason: `No candidates found. Route: ${route}. Allowed anchors: ${contract.allowedAnchorTerms.join(", ") || "any"}.`,
    };
  }

  // ── Validate best candidate ─────────────────────────────────────────
  for (const candidate of candidates) {
    const validation = validateCandidate(contract, candidate);
    if (validation.valid) {
      // Truncate long text to prevent paragraph dumps
      const truncated = candidate.text.length > 500
        ? candidate.text.slice(0, 500).replace(/\s+\S*$/, "") + "\u2026"
        : candidate.text;
      return {
        status: "found",
        answerText: truncated,
        downgradeReason: "",
      };
    }
  }

  // ── Best candidate failed → unclear ──────────────────────────────────
  const bestFailed = validateCandidate(contract, candidates[0]);
  return {
    status: "unclear",
    answerText: candidates[0].text,
    downgradeReason: `Best candidate rejected: ${bestFailed.reason}. ${candidates.length} candidate(s) found, none passed validation.`,
  };
}

// ── Contracts ──────────────────────────────────────────────────────────────

const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  project_activity: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["project activity", "project description", "summary of project", "project type", "project goals", "project design"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline"],
    allowedFactFields: ["projectType"],
    expectedShape: "project_activity_description",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  host_country: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["host country", "country"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    allowedFactFields: ["hostCountry", "projectCountry"],
    expectedShape: "country",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  },
  project_location: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["project location", "location", "project area", "site"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    allowedFactFields: ["projectLocation"],
    expectedShape: "location",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  methodology: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["methodology", "application of methodology", "applied methodology", "title and reference"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "participant"],
    allowedFactFields: ["methodologyPrimary", "methodologyModules"],
    expectedShape: "methodology_name_version",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  crediting_period: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "comments"],
    allowedFactFields: ["creditingPeriod"],
    expectedShape: "date_range_with_duration",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  monitoring_period: {
    applicableDocumentFamilies: ["verification_report", "monitoring_report", "validation_report", "any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["monitoring period", "reporting period", "verification period", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: ["monitoringPeriod", "reportingPeriod"],
    expectedShape: "date_range",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  baseline_scenario: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["baseline", "without project", "without-project"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "contact"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  additionality: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  leakage: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["leakage", "activity shifting"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  safeguards: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["safeguard", "grievance", "fpic"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  environmental_impacts: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["environmental impact", "environmental", "impact assessment"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  stakeholder_consultation: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "stakeholder participation", "community meeting"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  // VM0007
  vm0007_boundary: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  vm0007_leakage_belt: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["leakage belt"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_reference_region: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["reference region"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_baseline_deforestation: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["baseline deforestation", "deforestation", "degradation"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  vm0007_carbon_pools: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["carbon pool", "carbon stock"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_monitoring_plan: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  // AR-ACM0003
  ar_acm0003_arr_activity: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["fact_contract", "section"],
    allowedAnchorTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: ["projectType"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  ar_acm0003_boundary: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  ar_acm0003_carbon_pools: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  ar_acm0003_monitoring_plan: {
    applicableDocumentFamilies: ["any"],
    searchTargets: ["section"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
};

// ── Predefined checks ──────────────────────────────────────────────────────

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

// ── Public API ─────────────────────────────────────────────────────────────

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
