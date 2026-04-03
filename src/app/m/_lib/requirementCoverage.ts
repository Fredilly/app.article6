import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";

type RequirementCoverageRuleInput = {
  id: string;
  title: string;
  snippet: string;
  text?: string;
  type?: string;
  tags: string[];
  sectionId?: string;
  anchor?: string;
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
    type?: string;
    tags: string[];
  };
  provenance: RequirementCoverageProvenance;
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  linkedEvidence: RequirementCoverageLinkedEvidence[];
  candidateEvidence: RequirementCoverageLinkedEvidence[];
  status: RequirementCoverageStatus;
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

type RequirementCoverageLinkInput = {
  id: string;
  title?: string | null;
  type?: string | null;
  source?: RequirementCoverageLinkedEvidence["source"];
  evidenceId?: string | null;
  fragmentId?: string | null;
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
  const haystack = `${rule.title} ${rule.text} ${rule.tags.join(" ")} ${rule.type ?? ""}`.toLowerCase();
  const expected = new Set<RequirementCoverageExpectedEvidenceType>();

  if (/(monitor|report|frequency|sampling|inspection)/.test(haystack)) expected.add("monitoring-report");
  if (/(sheet|spreadsheet|table|workbook|ledger)/.test(haystack)) expected.add("spreadsheet-workbook");
  if (/\bpdd\b|project design document|project description/.test(haystack)) expected.add("pdd");
  if (/(gis|geojson|shape|shapefile|stac|aoi|spatial|map)/.test(haystack)) expected.add("gis");
  if (/(qa|qc|quality|checklist|inspection record)/.test(haystack)) expected.add("qa-qc-record");
  if (/(eligib|boundary|ownership|legal|title|attestation)/.test(haystack)) expected.add("eligibility-proof");
  if (/(calculate|formula|equation|parameter|input data|emission factor)/.test(haystack)) {
    expected.add("calculation-support");
  }

  return Array.from(expected);
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
  const provenanceSummary = [item.display_name, sectionLabel, pageLabel].filter(Boolean).join(" • ");
  return {
    id: fragment.fragment_id,
    evidenceId: item.evidence_id,
    fragmentId: fragment.fragment_id,
    title: item.display_name,
    type: item.type,
    source: "inventory",
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
  if (!types.length) return "No expected evidence metadata";
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

export function requirementProvenanceHint(row: RequirementCoverageRow): string {
  const sectionLabel = row.provenance.sectionTitle ?? row.provenance.sectionId ?? null;
  const pageLabel = typeof row.provenance.page === "number" ? `p. ${row.provenance.page}` : null;
  const anchorLabel = row.provenance.anchor ? row.provenance.anchor.replace(/^#/, "") : null;
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
          type: rule.type,
          tags: rule.tags,
        },
        provenance: {
          sectionId: primarySectionId,
          sectionTitle: primarySectionId ? sectionTitleById.get(primarySectionId) : undefined,
          page: undefined,
          anchor: rule.anchor,
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
