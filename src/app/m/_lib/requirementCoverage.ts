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
  linkedRequirementIds?: string[];
  provenanceSummary?: string;
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
  }));
}

function buildLinkedEvidenceByRuleIdFromInventory(
  inventoryItems: EvidenceInventoryItem[],
): Map<string, RequirementCoverageLinkInput[]> {
  const next = new Map<string, RequirementCoverageLinkInput[]>();

  for (const item of inventoryItems) {
    for (const ruleId of item.linked_requirement_ids ?? []) {
      const current = next.get(ruleId) ?? [];
      current.push({
        id: item.evidence_id,
        title: item.display_name,
        type: item.type,
        source: "inventory",
      });
      next.set(ruleId, current);
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
    return `${item.title} (${item.type})`;
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
  const statusesByRuleId = input.statusesByRuleId ?? new Map<string, RequirementCoverageStatus>();

  return [...input.rules]
    .map((rule) => {
      const linkedEvidence = normalizeLinkedEvidence(linkedEvidenceByRuleId, rule.id);
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
        status: deriveStatus(statusesByRuleId.get(rule.id), linkedEvidence),
      } satisfies RequirementCoverageRow;
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";
