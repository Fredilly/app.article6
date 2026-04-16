/**
 * Derive structured review support entries from evidence inventory items.
 *
 * These are support facts, not auto-verification.
 * Provenance is always grounded to source file, section, sheet, or excerpt.
 */

import type { EvidenceInventoryItem, EvidenceInventoryWorkbookGroup } from "@/lib/evidence/inventory";

export type DocumentSupportEntry = {
  id: string;
  kind: "pdd_excerpt" | "workbook_value" | "document";
  source: string;
  title: string;
  excerpt?: string;
  provenance: string;
  ruleLinked: boolean;
};

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}

function formatWorkbookPreview(group: EvidenceInventoryWorkbookGroup): string {
  const headers = group.column_names.slice(0, 5);
  const rows = group.rows.slice(0, 3);
  if (!headers.length || !rows.length) return "";
  const lines = rows.map((row) =>
    headers.map((h) => truncate(String(row[h] ?? ""), 20)).join(" │ ")
  );
  return [headers.join(" │ "), ...lines].join("\n");
}

function groupProvenance(group: EvidenceInventoryWorkbookGroup): string {
  const parts = [group.source_sheet, group.source_range ?? null].filter(Boolean);
  return parts.join(" · ") || group.display_name;
}

/**
 * Derive support entries for a specific rule from the evidence inventory.
 */
export function deriveDocumentSupport(
  inventory: EvidenceInventoryItem[],
  ruleId: string,
): DocumentSupportEntry[] {
  const entries: DocumentSupportEntry[] = [];

  for (const item of inventory) {
    // PDD fragments linked to this rule
    if (item.kind === "pdd" && item.pdd_fragment_links?.length) {
      for (const link of item.pdd_fragment_links) {
        if (link.rule_id !== ruleId) continue;
        const fragment = item.pdd_fragments?.find((f) => f.fragment_id === link.fragment_id);
        if (!fragment) continue;
        const sectionLabel = fragment.section_heading ?? fragment.section_label ?? fragment.fragment_id;
        const pageLabel =
          typeof fragment.page_start === "number"
            ? `p. ${fragment.page_start}${fragment.page_end && fragment.page_end !== fragment.page_start ? `-${fragment.page_end}` : ""}`
            : null;
        const provenance = [item.display_name, sectionLabel, pageLabel].filter(Boolean).join(" · ");
        entries.push({
          id: fragment.fragment_id,
          kind: "pdd_excerpt",
          source: item.display_name,
          title: sectionLabel,
          excerpt: fragment.excerpt ?? undefined,
          provenance,
          ruleLinked: true,
        });
      }
      continue;
    }

    // Non-PDD evidence linked to this rule
    const isLinkedToRule = item.linked_requirement_ids?.includes(ruleId);
    if (!isLinkedToRule) continue;

    // Workbook groups — show structured data
    // Check for workbook_record_groups regardless of kind label,
    // since uploads may arrive as kind "document" or "upload"
    if (item.workbook_record_groups?.length) {
      for (const group of item.workbook_record_groups) {
        const preview = formatWorkbookPreview(group);
        entries.push({
          id: group.group_id,
          kind: "workbook_value",
          source: item.display_name,
          title: group.display_name,
          excerpt: preview || undefined,
          provenance: `${item.display_name} · ${groupProvenance(group)}`,
          ruleLinked: true,
        });
      }
      continue;
    }

    // Only document-like evidence in this lane — STAC, photos, notes have their own surfaces
    if (item.kind === "stac-item" || item.kind === "photo" || item.kind === "note") continue;

    // Documents / monitoring reports — just the document itself
    entries.push({
      id: item.evidence_id,
      kind: "document",
      source: item.display_name,
      title: item.display_name,
      provenance: [item.display_name, item.source_summary].filter(Boolean).join(" · ") || item.display_name,
      ruleLinked: true,
    });
  }

  return entries;
}
