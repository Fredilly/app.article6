/**
 * Structured Evidence Checks with per-check validation contracts.
 *
 * Each check defines:
 *  - Applicability: which document types the check applies to
 *  - Allowed/rejected evidence anchors (section headings, fact fields)
 *  - Expected answer shape
 *  - Grounded-evidence requirements
 *
 * The router retrieves evidence; the contract validates it.
 */

import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type EvidenceCheckId =
  // Universal
  | "project_activity" | "host_country" | "project_location" | "methodology"
  | "crediting_period" | "monitoring_period" | "baseline_scenario"
  | "additionality" | "leakage" | "safeguards" | "environmental_impacts"
  | "stakeholder_consultation"
  // VM0007
  | "vm0007_boundary" | "vm0007_leakage_belt" | "vm0007_reference_region"
  | "vm0007_baseline_deforestation" | "vm0007_carbon_pools" | "vm0007_monitoring_plan"
  // AR-ACM0003
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
  quotes: string[];
  pages: number[];
  sections: string[];
  evidenceSpanIds: string[];
  warnings: string[];
};

// ── Contract types ─────────────────────────────────────────────────────────

export type AnswerShape =
  | "country"
  | "methodology_code"
  | "methodology_name_version"
  | "date_range"
  | "date_range_with_duration"
  | "section_summary"
  | "location"
  | "yes_no_explanation"
  | "project_title"
  | "project_activity_description";

type DocumentFamilyFilter = "PDD" | "validation_report" | "verification_report" | "monitoring_report" | "any";

/**
 * Per-check validation contract.
 *
 * Fields:
 * - applicableDocumentFamilies: document families where this check makes
 *   sense.  "any" means universal.
 * - allowedAnchorTerms: section heading terms that qualify as valid
 *   evidence for this check.  Section paths must contain at least one
 *   of these terms.
 * - forbiddenAnchorTerms: section heading terms that disqualify evidence
 *   even if the router found a keyword match.  Prevents false positives
 *   from unrelated sections.
 * - allowedFactFields: fact fields that are acceptable evidence for this
 *   check (for project_fact_contract route).
 *   Empty array = no fact-based evidence allowed (must come from sections).
 * - expectedShape: what the answer value should look like.
 * - requiresGroundedEvidence: if true, requires at least one of
 *   quotes/pages/sections/evidenceSpanIds.
 * - minimumEvidenceWords: minimum word count in the answer text to
 *   consider it substantive (prevents heading-only echoes).
 * - exactMatchAllowedFromHeadingsOnly: if true, heading-only spans are
 *   rejected as non-substantive (must come from body text / facts).
 */
export type EvidenceCheckContract = {
  applicableDocumentFamilies: DocumentFamilyFilter[];
  allowedAnchorTerms: string[];
  forbiddenAnchorTerms: string[];
  allowedFactFields: string[];
  allowedRoutes: string[];
  expectedShape: AnswerShape;
  requiresGroundedEvidence: boolean;
  minimumEvidenceWords: number;
  rejectHeadingOnly: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeAnchor(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function anchorMatches(sectionPath: string[], terms: string[]): boolean {
  const lower = sectionPath.join(" > ").toLowerCase();
  return terms.some((t) => lower.includes(normalizeAnchor(t)));
}

function anchorForbidden(sectionPath: string[], terms: string[]): boolean {
  if (terms.length === 0) return false;
  return anchorMatches(sectionPath, terms);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Validate a router result against a check contract.
 * Returns the status and optionally shaped/trimmed answer text.
 */
export function validateCheck(
  contract: EvidenceCheckContract,
  routerResult: DeterministicRouterResult,
  documentFamily: string = "any",
): { status: EvidenceCheckStatus; answerText: string } {
  const { status, route, quotes, pages, sectionPaths, evidenceSpanIds, answerText, warnings } = routerResult;

  // ── Not applicable ──────────────────────────────────────────────────
  if (!contract.applicableDocumentFamilies.includes("any")) {
    const normalizedFamily = documentFamily.toLowerCase().replace(/[^a-z]/g, "");
    const applicable = contract.applicableDocumentFamilies.some((f) => {
      if (f === "any") return true;
      return normalizedFamily.includes(f);
    });
    if (!applicable) {
      return { status: "not_applicable", answerText: "" };
    }
  }

  // ── Router didn't find anything ──────────────────────────────────────
  if (status === "no_evidence") {
    return { status: "missing", answerText };
  }

  // ── Route validation ─────────────────────────────────────────────────
  if (contract.allowedRoutes.length > 0 && !contract.allowedRoutes.includes(route)) {
    return { status: "unclear", answerText };
  }

  // ── Anchor validation ───────────────────────────────────────────────
  // Source must match allowed anchor terms AND must not be from forbidden terms.
  const hasAllowedAnchor = contract.allowedAnchorTerms.length === 0
    || anchorMatches(sectionPaths, contract.allowedAnchorTerms);
  const hasForbiddenAnchor = anchorForbidden(sectionPaths, contract.forbiddenAnchorTerms);

  if (!hasAllowedAnchor || hasForbiddenAnchor) {
    return { status: "unclear", answerText };
  }

  // ── Grounded evidence ────────────────────────────────────────────────
  if (contract.requiresGroundedEvidence) {
    const hasGrounded = quotes.length > 0 || pages.length > 0
      || sectionPaths.length > 0 || evidenceSpanIds.length > 0;
    if (!hasGrounded) {
      return { status: "unclear", answerText };
    }
  }

  // ── Fact route validation ────────────────────────────────────────────
  if (route === "project_fact_contract" && contract.allowedFactFields.length > 0) {
    const factTerms = contract.allowedFactFields.map(normalizeAnchor).join("|");
    const hasFactMatch = new RegExp(`\\b(?:${factTerms})\\b`, "i").test(answerText);
    if (!hasFactMatch) {
      return { status: "unclear", answerText };
    }
  }

  // ── Substantive content ──────────────────────────────────────────────
  const wc = wordCount(answerText);
  if (wc < contract.minimumEvidenceWords) {
    return { status: "unclear", answerText };
  }

  // ── Heading-only rejection ───────────────────────────────────────────
  if (contract.rejectHeadingOnly && quotes.length > 0) {
    const allQuotesAreHeadings = quotes.every((q) => {
      const qLower = q.trim().toLowerCase();
      // Check if quote is just a heading echo (matches section path term)
      return wordCount(q) <= 4 || sectionPaths.some((p) =>
        p.toLowerCase().includes(qLower) && wordCount(q) <= 4
      );
    });
    if (allQuotesAreHeadings) {
      return { status: "unclear", answerText };
    }
  }

  // ── Structured-input only ────────────────────────────────────────────
  if (warnings.includes("structured_input_provenance") && contract.requiresGroundedEvidence) {
    return { status: "unclear", answerText };
  }

  // ── Passed all validation ────────────────────────────────────────────
  return { status: status === "answered" ? "found" : "unclear", answerText };
}

// ── Contracts ──────────────────────────────────────────────────────────────

const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  // ── Fact checks — cover table / fact contract evidence ────────────────
  project_activity: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: [],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline"],
    allowedFactFields: ["projectType"],
    allowedRoutes: ["project_fact_contract"],
    expectedShape: "project_activity_description",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  host_country: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["host country", "country"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    allowedFactFields: ["hostCountry", "projectCountry"],
    allowedRoutes: ["project_fact_contract"],
    expectedShape: "country",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 1,
    rejectHeadingOnly: true,
  },
  project_location: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["project location", "location", "project area", "site"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"],
    allowedFactFields: ["projectLocation"],
    allowedRoutes: ["project_fact_contract", "section_index"],
    expectedShape: "location",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  methodology: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["methodology", "application of methodology", "applied methodology"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "participant"],
    allowedFactFields: ["methodologyPrimary", "methodologyModules"],
    allowedRoutes: ["project_fact_contract", "section_index"],
    expectedShape: "methodology_name_version",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  crediting_period: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "comments"],
    allowedFactFields: ["creditingPeriod"],
    allowedRoutes: ["project_fact_contract"],
    expectedShape: "date_range_with_duration",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  monitoring_period: {
    applicableDocumentFamilies: ["verification_report", "monitoring_report", "validation_report"],
    allowedAnchorTerms: ["monitoring period", "reporting period", "verification period", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: ["monitoringPeriod", "reportingPeriod"],
    allowedRoutes: ["project_fact_contract", "section_index"],
    expectedShape: "date_range",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 2,
    rejectHeadingOnly: true,
  },
  // ── Section checks — body text from relevant sections ─────────────────
  baseline_scenario: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["baseline", "without project", "without-project"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "contact"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  additionality: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  leakage: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["leakage", "activity shifting"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  safeguards: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["safeguard", "grievance", "fpic"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  environmental_impacts: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["environmental impact", "environmental", "impact assessment"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  stakeholder_consultation: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "stakeholder participation", "community meeting"],
    forbiddenAnchorTerms: [],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  // ── VM0007 ───────────────────────────────────────────────────────────
  vm0007_boundary: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  vm0007_leakage_belt: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["leakage belt"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_reference_region: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["reference region"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_baseline_deforestation: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["baseline deforestation", "deforestation", "degradation"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  vm0007_carbon_pools: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["carbon pool", "carbon stock"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  vm0007_monitoring_plan: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  // ── AR-ACM0003 ───────────────────────────────────────────────────────
  ar_acm0003_arr_activity: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index", "project_fact_contract"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  ar_acm0003_boundary: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["project boundary", "boundary"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 4,
    rejectHeadingOnly: true,
  },
  ar_acm0003_carbon_pools: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
    expectedShape: "section_summary",
    requiresGroundedEvidence: true,
    minimumEvidenceWords: 3,
    rejectHeadingOnly: true,
  },
  ar_acm0003_monitoring_plan: {
    applicableDocumentFamilies: ["any"],
    allowedAnchorTerms: ["monitoring plan", "monitoring"],
    forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"],
    allowedFactFields: [],
    allowedRoutes: ["section_index"],
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
