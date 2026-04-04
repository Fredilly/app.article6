import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";

type RequirementCoverageRuleInput = {
  id: string;
  title: string;
  snippet: string;
  text?: string;
  summary?: string;
  logic?: string;
  notes?: string;
  when?: string[];
  expectedEvidence?: string[];
  type?: string;
  tags: string[];
  sectionId?: string;
  anchor?: string;
  refs?: {
    primarySection?: string;
    sectionAnchor?: string;
    sectionStableId?: string;
    tools?: string[];
  };
  citations?: Array<{
    sectionId?: string;
    anchor?: string;
    label?: string;
  }>;
};

export const REQUIREMENT_COVERAGE_STATUSES = ["missing", "partial", "linked", "needs-review"] as const;

export type RequirementCoverageStatus = (typeof REQUIREMENT_COVERAGE_STATUSES)[number];

export type RequirementCoverageExpectedEvidenceType =
  | "monitoring-report"
  | "spreadsheet-workbook"
  | "pdd"
  | "gis"
  | "qa-qc-record"
  | "eligibility-proof"
  | "calculation-support"
  | "other";

export type RequirementCoverageProvenance = {
  sectionId?: string;
  sectionTitle?: string;
  page?: number;
  anchor?: string;
  primarySection?: string;
  sectionAnchor?: string;
  sectionStableId?: string;
  tools: string[];
  citations: Array<{
    sectionId?: string;
    anchor?: string;
    label?: string;
  }>;
};

export type RequirementCoverageLinkedEvidence = {
  id: string;
  title: string;
  type: string;
  source: "pin" | "run" | "inventory" | "unknown";
  evidenceId?: string;
  fragmentId?: string;
  fragmentLabel?: string;
  linkedRequirementIds?: string[];
  provenanceSummary?: string;
  documentLabel?: string;
  pageStart?: number;
  pageEnd?: number;
  sectionLabel?: string;
  sectionHeading?: string;
  excerpt?: string;
};

export type RequirementCoverageRow = {
  ruleId: string;
  ruleSummary: {
    title: string;
    snippet: string;
    summary?: string;
    logic?: string;
    notes?: string;
    when: string[];
    type?: string;
    tags: string[];
  };
  provenance: RequirementCoverageProvenance;
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  linkedEvidence: RequirementCoverageLinkedEvidence[];
  candidateEvidence: RequirementCoverageLinkedEvidence[];
  status: RequirementCoverageStatus;
};

export type RequirementReconciliationStatus = "supported" | "partial" | "needs-review" | "missing-evidence";

export type RequirementReconciliation = {
  status: RequirementReconciliationStatus;
  label: "Supported" | "Partial" | "Needs review" | "Missing evidence";
  reason: string;
  satisfiedExpectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  missingExpectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
};

export const REQUIREMENT_COVERAGE_STATUS_META: Record<
  RequirementCoverageStatus,
  { label: string; tone: string; description: string }
> = {
  missing: {
    label: "Unresolved",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    description: "No linked evidence yet.",
  },
  partial: {
    label: "Linked",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    description: "Evidence is linked but still needs reconciliation.",
  },
  linked: {
    label: "Complete",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "Evidence and verification activity exist.",
  },
  "needs-review": {
    label: "Needs review",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    description: "Linked evidence needs reviewer attention.",
  },
};

export const EXPECTED_EVIDENCE_LABELS: Record<RequirementCoverageExpectedEvidenceType, string> = {
  "monitoring-report": "Monitoring report",
  "spreadsheet-workbook": "Spreadsheet workbook",
  pdd: "PDD",
  gis: "GIS or map evidence",
  "qa-qc-record": "QA/QC record",
  "eligibility-proof": "Eligibility proof",
  "calculation-support": "Calculation support",
  other: "Other evidence",
};

export const REQUIREMENT_RECONCILIATION_META: Record<
  RequirementReconciliationStatus,
  { label: RequirementReconciliation["label"]; tone: string }
> = {
  supported: {
    label: "Supported",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  partial: {
    label: "Partial",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  "needs-review": {
    label: "Needs review",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  "missing-evidence": {
    label: "Missing evidence",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

type RequirementCoverageLinkInput = {
  id: string;
  title?: string | null;
  type?: string | null;
  source?: RequirementCoverageLinkedEvidence["source"];
  evidenceId?: string | null;
  fragmentId?: string | null;
  fragmentLabel?: string | null;
  provenanceSummary?: string | null;
  documentLabel?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionLabel?: string | null;
  sectionHeading?: string | null;
  excerpt?: string | null;
};

type BuildRequirementCoverageRowsInput = {
  rules: RequirementCoverageRuleInput[];
  sectionTitleById?: Map<string, string>;
  linkedEvidenceByRuleId?: Map<string, RequirementCoverageLinkInput[]>;
  inventoryItems?: EvidenceInventoryItem[];
  statusesByRuleId?: Map<string, RequirementCoverageStatus>;
};

function normalizeSnippet(rule: RequirementCoverageRuleInput): string {
  return rule.snippet?.trim() || rule.text?.replace(/\s+/g, " ").trim() || "No rule summary available.";
}

function expectedEvidenceTypesForRule(rule: RequirementCoverageRuleInput): RequirementCoverageExpectedEvidenceType[] {
  const normalized = new Set<RequirementCoverageExpectedEvidenceType>();
  for (const value of rule.expectedEvidence ?? []) {
    const key = value.trim().toLowerCase();
    if (key === "monitoring-report" || key === "monitoring_report") normalized.add("monitoring-report");
    else if (key === "spreadsheet-workbook" || key === "spreadsheet_workbook" || key === "workbook") normalized.add("spreadsheet-workbook");
    else if (key === "pdd") normalized.add("pdd");
    else if (key === "gis") normalized.add("gis");
    else if (key === "qa-qc-record" || key === "qa_qc_record") normalized.add("qa-qc-record");
    else if (key === "eligibility-proof" || key === "eligibility_proof") normalized.add("eligibility-proof");
    else if (key === "calculation-support" || key === "calculation_support") normalized.add("calculation-support");
    else if (key) normalized.add("other");
  }
  return Array.from(normalized);
}

function normalizeLinkedEvidence(
  linkedEvidenceByRuleId: Map<string, RequirementCoverageLinkInput[]>,
  ruleId: string,
): RequirementCoverageLinkedEvidence[] {
  return (linkedEvidenceByRuleId.get(ruleId) ?? []).map((item) => ({
    id: item.id,
    title: item.title?.trim() || item.id,
    type: item.type?.trim() || "evidence",
    source: item.source ?? "unknown",
    evidenceId: item.evidenceId?.trim() || undefined,
    fragmentId: item.fragmentId?.trim() || undefined,
    fragmentLabel: item.fragmentLabel?.trim() || undefined,
    provenanceSummary: item.provenanceSummary?.trim() || undefined,
    documentLabel: item.documentLabel?.trim() || undefined,
    pageStart: typeof item.pageStart === "number" ? item.pageStart : undefined,
    pageEnd: typeof item.pageEnd === "number" ? item.pageEnd : undefined,
    sectionLabel: item.sectionLabel?.trim() || undefined,
    sectionHeading: item.sectionHeading?.trim() || undefined,
    excerpt: item.excerpt?.trim() || undefined,
  }));
}

function formatPddPageLabel(pageStart?: number, pageEnd?: number): string | null {
  if (typeof pageStart === "number" && typeof pageEnd === "number" && pageStart !== pageEnd) {
    return `p. ${pageStart}-${pageEnd}`;
  }
  if (typeof pageStart === "number") return `p. ${pageStart}`;
  if (typeof pageEnd === "number") return `p. ${pageEnd}`;
  return null;
}

function buildPddProvenanceSummary(item: EvidenceInventoryItem, fragmentId: string): RequirementCoverageLinkInput | null {
  const fragment = item.pdd_fragments?.find((entry) => entry.fragment_id === fragmentId);
  if (!fragment) return null;
  const pageLabel = formatPddPageLabel(fragment.page_start, fragment.page_end);
  const sectionLabel = fragment.section_heading ?? fragment.section_label ?? null;
  const fragmentLabel = fragment.label?.trim() || sectionLabel || fragment.fragment_id;
  const provenanceSummary = [item.display_name, fragmentLabel, pageLabel].filter(Boolean).join(" • ");
  return {
    id: fragment.fragment_id,
    evidenceId: item.evidence_id,
    fragmentId: fragment.fragment_id,
    title: fragmentLabel,
    type: item.type,
    source: "inventory",
    fragmentLabel,
    provenanceSummary,
    documentLabel: item.display_name,
    pageStart: fragment.page_start,
    pageEnd: fragment.page_end,
    sectionLabel: fragment.section_label,
    sectionHeading: fragment.section_heading,
    excerpt: fragment.excerpt,
  };
}

function buildLinkedEvidenceByRuleIdFromInventory(
  inventoryItems: EvidenceInventoryItem[],
): Map<string, RequirementCoverageLinkInput[]> {
  const next = new Map<string, RequirementCoverageLinkInput[]>();

  for (const item of inventoryItems) {
    if (item.kind === "pdd" && item.pdd_fragment_links?.length) {
      for (const link of item.pdd_fragment_links) {
        const current = next.get(link.rule_id) ?? [];
        const fragmentEvidence = buildPddProvenanceSummary(item, link.fragment_id);
        if (fragmentEvidence) current.push(fragmentEvidence);
        next.set(link.rule_id, current);
      }
      continue;
    }
    for (const ruleId of item.linked_requirement_ids ?? []) {
      const current = next.get(ruleId) ?? [];
      current.push({
        id: item.evidence_id,
        title: item.display_name,
        type: item.type,
        source: "inventory",
        evidenceId: item.evidence_id,
      });
      next.set(ruleId, current);
    }
  }

  return next;
}

function buildCandidateEvidenceByRuleIdFromInventory(
  inventoryItems: EvidenceInventoryItem[],
  rules: RequirementCoverageRuleInput[],
): Map<string, RequirementCoverageLinkInput[]> {
  const expectedTypesByRuleId = new Map(
    rules.map((rule) => [rule.id, expectedEvidenceTypesForRule(rule)]),
  );
  const next = new Map<string, RequirementCoverageLinkInput[]>();

  for (const item of inventoryItems) {
    for (const group of item.workbook_record_groups ?? []) {
      for (const [ruleId, expectedTypes] of expectedTypesByRuleId.entries()) {
        const candidateTypes = new Set<string>(group.candidate_evidence_types);
        if (!expectedTypes.some((type) => candidateTypes.has(type))) continue;
        const current = next.get(ruleId) ?? [];
        current.push({
          id: group.group_id,
          title: `${item.display_name} · ${group.display_name}`,
          type: group.group_type,
          source: "inventory",
        });
        next.set(ruleId, current);
      }
    }
  }

  return next;
}

function deriveStatus(
  explicitStatus: RequirementCoverageStatus | undefined,
  linkedEvidence: RequirementCoverageLinkedEvidence[],
): RequirementCoverageStatus {
  if (explicitStatus) return explicitStatus;
  if (linkedEvidence.length > 1) return "linked";
  if (linkedEvidence.length === 1) return "partial";
  return "missing";
}

export function summarizeExpectedEvidence(types: RequirementCoverageExpectedEvidenceType[]): string {
  if (!types.length) return "No expected evidence defined for this rule.";
  return types.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type).join(", ");
}

export function summarizeLinkedEvidence(items: RequirementCoverageLinkedEvidence[]): string {
  if (!items.length) return "No linked evidence yet";
  if (items.length === 1) {
    const item = items[0];
    const detail = item.provenanceSummary?.trim();
    return detail ? `${item.title} (${item.type} • ${detail})` : `${item.title} (${item.type})`;
  }
  return `${items.length} linked evidence items`;
}

function linkedEvidenceTypesForReconciliation(
  item: RequirementCoverageLinkedEvidence,
): RequirementCoverageExpectedEvidenceType[] {
  const haystack = [
    item.type,
    item.title,
    item.documentLabel,
    item.provenanceSummary,
    item.fragmentLabel,
    item.sectionHeading,
    item.sectionLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matched = new Set<RequirementCoverageExpectedEvidenceType>();
  if (haystack.includes("monitoring-report") || haystack.includes("monitoring report")) matched.add("monitoring-report");
  if (haystack.includes("spreadsheet-workbook") || haystack.includes("spreadsheet workbook") || haystack.includes("workbook")) {
    matched.add("spreadsheet-workbook");
  }
  if (haystack.includes("calculation-support") || haystack.includes("calculation support") || haystack.includes("calculation")) {
    matched.add("calculation-support");
  }
  if (haystack.includes("pdd")) matched.add("pdd");
  if (haystack.includes("gis") || haystack.includes("stac") || haystack.includes("map evidence")) matched.add("gis");
  if (haystack.includes("qa/qc") || haystack.includes("qa-qc") || haystack.includes("qa qc")) matched.add("qa-qc-record");
  if (haystack.includes("eligibility")) matched.add("eligibility-proof");
  return Array.from(matched);
}

function hasReviewerArtifact(input: { minutes?: string | null; outcomeNote?: string | null }): boolean {
  return Boolean(input.minutes?.trim() || input.outcomeNote?.trim());
}

export function reconcileRequirement(input: {
  linkedEvidence: RequirementCoverageLinkedEvidence[];
  expectedEvidenceTypes?: RequirementCoverageExpectedEvidenceType[];
  reviewerMinutes?: string | null;
  reviewerOutcomeNote?: string | null;
}): RequirementReconciliation {
  const linkedEvidence = input.linkedEvidence ?? [];
  const expected = Array.from(new Set(input.expectedEvidenceTypes ?? [])).sort((a, b) => a.localeCompare(b));
  const reviewerSaved = hasReviewerArtifact({ minutes: input.reviewerMinutes, outcomeNote: input.reviewerOutcomeNote });

  if (!linkedEvidence.length) {
    return {
      status: "missing-evidence",
      label: REQUIREMENT_RECONCILIATION_META["missing-evidence"].label,
      reason: "No linked evidence for this rule.",
      satisfiedExpectedEvidenceTypes: [],
      missingExpectedEvidenceTypes: expected,
    };
  }

  const satisfied = new Set<RequirementCoverageExpectedEvidenceType>();
  for (const item of linkedEvidence) {
    for (const matchedType of linkedEvidenceTypesForReconciliation(item)) satisfied.add(matchedType);
  }
  const satisfiedExpectedEvidenceTypes = expected.filter((type) => satisfied.has(type));
  const missingExpectedEvidenceTypes = expected.filter((type) => !satisfied.has(type));

  if (expected.length) {
    if (missingExpectedEvidenceTypes.length) {
      const missingLabels = missingExpectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type]).join(", ");
      const satisfiedLabels = satisfiedExpectedEvidenceTypes.length
        ? ` Satisfied: ${satisfiedExpectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type]).join(", ")}.`
        : "";
      return {
        status: "partial",
        label: REQUIREMENT_RECONCILIATION_META.partial.label,
        reason: `Missing expected evidence: ${missingLabels}.${satisfiedLabels}`,
        satisfiedExpectedEvidenceTypes,
        missingExpectedEvidenceTypes,
      };
    }
    return {
      status: "supported",
      label: REQUIREMENT_RECONCILIATION_META.supported.label,
      reason: reviewerSaved ? "All expected evidence is linked and reviewer artifact is saved." : "All expected evidence is linked.",
      satisfiedExpectedEvidenceTypes,
      missingExpectedEvidenceTypes: [],
    };
  }

  if (reviewerSaved) {
    return {
      status: "supported",
      label: REQUIREMENT_RECONCILIATION_META.supported.label,
      reason: "Linked evidence is present and reviewer artifact is saved.",
      satisfiedExpectedEvidenceTypes: [],
      missingExpectedEvidenceTypes: [],
    };
  }

  return {
    status: "needs-review",
    label: REQUIREMENT_RECONCILIATION_META["needs-review"].label,
    reason: "Linked evidence is present, but no reviewer artifact is saved yet.",
    satisfiedExpectedEvidenceTypes: [],
    missingExpectedEvidenceTypes: [],
  };
}

export function requirementProvenanceHint(row: RequirementCoverageRow): string {
  const sectionLabel =
    row.provenance.primarySection ??
    row.provenance.sectionTitle ??
    row.provenance.sectionStableId ??
    row.provenance.sectionId ??
    null;
  const pageLabel = typeof row.provenance.page === "number" ? `p. ${row.provenance.page}` : null;
  const anchorLabel = (row.provenance.sectionAnchor ?? row.provenance.anchor)?.replace(/^#/, "") ?? null;
  return [sectionLabel, pageLabel, anchorLabel].filter(Boolean).join(" • ") || "Provenance pending";
}

export function buildRequirementCoverageRows(input: BuildRequirementCoverageRowsInput): RequirementCoverageRow[] {
  const sectionTitleById = input.sectionTitleById ?? new Map<string, string>();
  const linkedEvidenceByRuleId =
    input.inventoryItems?.length
      ? buildLinkedEvidenceByRuleIdFromInventory(input.inventoryItems)
      : (input.linkedEvidenceByRuleId ?? new Map<string, RequirementCoverageLinkInput[]>());
  const candidateEvidenceByRuleId =
    input.inventoryItems?.length
      ? buildCandidateEvidenceByRuleIdFromInventory(input.inventoryItems, input.rules)
      : new Map<string, RequirementCoverageLinkInput[]>();
  const statusesByRuleId = input.statusesByRuleId ?? new Map<string, RequirementCoverageStatus>();

  return [...input.rules]
    .map((rule) => {
      const linkedEvidence = normalizeLinkedEvidence(linkedEvidenceByRuleId, rule.id);
      const candidateEvidence = normalizeLinkedEvidence(candidateEvidenceByRuleId, rule.id);
      const primarySectionId =
        rule.sectionId ?? rule.citations?.find((citation) => citation.sectionId)?.sectionId;
      return {
        ruleId: rule.id,
        ruleSummary: {
          title: rule.title,
          snippet: normalizeSnippet(rule),
          summary: rule.summary?.trim() || undefined,
          logic: rule.logic?.trim() || undefined,
          notes: rule.notes?.trim() || undefined,
          when: (rule.when ?? []).map((item) => item.trim()).filter(Boolean),
          type: rule.type,
          tags: rule.tags,
        },
        provenance: {
          sectionId: primarySectionId,
          sectionTitle: primarySectionId ? sectionTitleById.get(primarySectionId) : undefined,
          page: undefined,
          anchor: rule.anchor,
          primarySection: rule.refs?.primarySection,
          sectionAnchor: rule.refs?.sectionAnchor,
          sectionStableId: rule.refs?.sectionStableId,
          tools: rule.refs?.tools ?? [],
          citations: rule.citations ?? [],
        },
        expectedEvidenceTypes: expectedEvidenceTypesForRule(rule),
        linkedEvidence,
        candidateEvidence,
        status: deriveStatus(statusesByRuleId.get(rule.id), linkedEvidence),
      } satisfies RequirementCoverageRow;
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
