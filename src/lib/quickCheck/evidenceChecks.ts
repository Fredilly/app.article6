/**
 * Structured Evidence Checks for Quick Check.
 *
 * Replaces free-form Q&A with a fixed set of checks that the router
 * already handles.  Each check is a predefined question string mapped
 * to a label + icon + methodology specificity.
 */

export type EvidenceCheckId =
  // ── Universal checks (always shown) ─────────────────────────────
  | "project_activity"
  | "host_country"
  | "project_location"
  | "methodology"
  | "crediting_period"
  | "monitoring_period"
  | "baseline_scenario"
  | "additionality"
  | "leakage"
  | "safeguards"
  | "environmental_impacts"
  | "stakeholder_consultation"
  // ── VM0007-specific checks ──────────────────────────────────────
  | "vm0007_boundary"
  | "vm0007_leakage_belt"
  | "vm0007_reference_region"
  | "vm0007_baseline_deforestation"
  | "vm0007_carbon_pools"
  | "vm0007_monitoring_plan"
  // ── AR-ACM0003-specific checks ──────────────────────────────────
  | "ar_acm0003_arr_activity"
  | "ar_acm0003_boundary"
  | "ar_acm0003_carbon_pools"
  | "ar_acm0003_monitoring_plan";

export type EvidenceCheck = {
  id: EvidenceCheckId;
  label: string;
  question: string;
  methodologySpecific?: string; // methodology ID this check is specific to, if any
};

export type EvidenceCheckStatus = "found" | "missing" | "unclear";

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
