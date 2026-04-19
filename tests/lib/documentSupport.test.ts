import { deriveDocumentSupport } from "@/lib/verify/documentSupport";
import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";

function makePddItem(overrides: Partial<EvidenceInventoryItem> = {}): EvidenceInventoryItem {
  return {
    evidence_id: "pdd-1",
    dedupe_key: "pdd-1",
    display_name: "Project Design Document v2.pdf",
    kind: "pdd",
    type: "pdd",
    source_summary: "PDD upload",
    provenance_summary: "",
    added_at: "2026-01-01T00:00:00Z",
    link_state: "linked",
    linked_requirement_ids: [],
    pdd_document: { evidence_id: "pdd-1", file_name: "PDD.pdf", mime: "application/pdf", added_at: "2026-01-01T00:00:00Z" },
    pdd_fragments: [
      {
        fragment_id: "frag-1",
        evidence_id: "pdd-1",
        label: "Monitoring plan",
        section_heading: "Section 4.2 — Monitoring",
        section_label: "S-4-2",
        page_start: 12,
        page_end: 12,
        excerpt: "Satellite imagery shall be used to monitor forest cover change on a quarterly basis.",
      },
    ],
    pdd_fragment_links: [{ fragment_id: "frag-1", rule_id: "R-1" }],
    ...overrides,
  };
}

function makeWorkbookItem(overrides: Partial<EvidenceInventoryItem> = {}): EvidenceInventoryItem {
  return {
    evidence_id: "wb-1",
    dedupe_key: "wb-1",
    display_name: "Monitoring_Workbook_2024.xlsx",
    kind: "workbook",
    type: "spreadsheet-workbook",
    source_summary: "Workbook upload",
    provenance_summary: "",
    added_at: "2026-01-01T00:00:00Z",
    link_state: "linked",
    linked_requirement_ids: ["R-2"],
    workbook_assets: [],
    workbook_record_groups: [
      {
        group_id: "grp-1",
        group_type: "monitoring_period_table",
        display_name: "Annual Monitoring Data",
        workbook_id: "wb-1",
        workbook_filename: "Monitoring_Workbook_2024.xlsx",
        source_sheet: "Sheet1",
        source_range: "A1:D10",
        row_count: 9,
        column_names: ["year", "area_ha", "emissions_tCO2", "method"],
        rows: [
          { year: "2022", area_ha: "1500", emissions_tCO2: "12500", method: "satellite" },
          { year: "2023", area_ha: "1480", emissions_tCO2: "11800", method: "satellite" },
          { year: "2024", area_ha: "1450", emissions_tCO2: "11200", method: "satellite" },
        ],
        provenance_summary: "Sheet1 A1:D10",
        candidate_evidence_types: ["monitoring-report"],
      },
    ],
    ...overrides,
  };
}

function makeDocumentItem(overrides: Partial<EvidenceInventoryItem> = {}): EvidenceInventoryItem {
  return {
    evidence_id: "doc-1",
    dedupe_key: "doc-1",
    display_name: "Monitoring Report 2024.pdf",
    kind: "document",
    type: "monitoring-report",
    source_summary: "Document upload",
    provenance_summary: "",
    added_at: "2026-01-01T00:00:00Z",
    link_state: "linked",
    linked_requirement_ids: ["R-3"],
    ...overrides,
  };
}

describe("deriveDocumentSupport", () => {
  describe("PDD excerpts", () => {
    it("extracts linked PDD fragments with excerpt and provenance", () => {
      const entries = deriveDocumentSupport([makePddItem()], "R-1");
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("pdd_excerpt");
      expect(entries[0].excerpt).toContain("Satellite imagery");
      expect(entries[0].provenance).toContain("Project Design Document v2.pdf");
      expect(entries[0].provenance).toContain("Section 4.2 — Monitoring");
      expect(entries[0].provenance).toContain("p. 12");
      expect(entries[0].ruleLinked).toBe(true);
    });

    it("returns empty for rules without linked PDD fragments", () => {
      const entries = deriveDocumentSupport([makePddItem()], "R-99");
      expect(entries).toHaveLength(0);
    });
  });

  describe("workbook values", () => {
    it("extracts workbook record groups with structured preview", () => {
      const entries = deriveDocumentSupport([makeWorkbookItem()], "R-2");
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("workbook_value");
      expect(entries[0].title).toBe("Annual Monitoring Data");
      expect(entries[0].excerpt).toContain("year");
      expect(entries[0].excerpt).toContain("1500");
      expect(entries[0].provenance).toContain("Sheet1");
      expect(entries[0].provenance).toContain("A1:D10");
    });

    it("returns empty for rules without linked workbook evidence", () => {
      const entries = deriveDocumentSupport([makeWorkbookItem()], "R-99");
      expect(entries).toHaveLength(0);
    });
  });

  describe("documents / monitoring reports", () => {
    it("extracts linked documents with source provenance", () => {
      const entries = deriveDocumentSupport([makeDocumentItem()], "R-3");
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("document");
      expect(entries[0].title).toBe("Monitoring Report 2024.pdf");
      expect(entries[0].provenance).toContain("Monitoring Report 2024.pdf");
      expect(entries[0].ruleLinked).toBe(true);
    });
  });

  describe("blocked / empty states", () => {
    it("returns empty for empty inventory", () => {
      expect(deriveDocumentSupport([], "R-1")).toHaveLength(0);
    });

    it("returns empty for unrelated rules", () => {
      const inv = [makePddItem(), makeWorkbookItem(), makeDocumentItem()];
      expect(deriveDocumentSupport(inv, "R-999")).toHaveLength(0);
    });

    it("handles inventory items without linked rules", () => {
      const item = makeWorkbookItem({ linked_requirement_ids: [] });
      expect(deriveDocumentSupport([item], "R-2")).toHaveLength(0);
    });

    it("excludes STAC items from document support", () => {
      const stacItem: EvidenceInventoryItem = {
        evidence_id: "stac-1",
        dedupe_key: "stac-1",
        display_name: "S2A_36LYJ_20260411",
        kind: "stac-item",
        type: "stac",
        source_summary: "Satellite run",
        provenance_summary: "",
        added_at: "2026-01-01T00:00:00Z",
        link_state: "linked",
        linked_requirement_ids: ["R-1"],
      };
      expect(deriveDocumentSupport([stacItem], "R-1")).toHaveLength(0);
    });

    it("excludes photo evidence from document support", () => {
      const photo: EvidenceInventoryItem = {
        evidence_id: "photo-1",
        dedupe_key: "photo-1",
        display_name: "Field photo",
        kind: "photo",
        type: "photo",
        source_summary: "Photo",
        provenance_summary: "",
        added_at: "2026-01-01T00:00:00Z",
        link_state: "linked",
        linked_requirement_ids: ["R-1"],
      };
      expect(deriveDocumentSupport([photo], "R-1")).toHaveLength(0);
    });

    it("excludes note evidence from document support", () => {
      const note: EvidenceInventoryItem = {
        evidence_id: "note-1",
        dedupe_key: "note-1",
        display_name: "Reviewer note",
        kind: "note",
        type: "note",
        source_summary: "Note",
        provenance_summary: "",
        added_at: "2026-01-01T00:00:00Z",
        link_state: "linked",
        linked_requirement_ids: ["R-1"],
      };
      expect(deriveDocumentSupport([note], "R-1")).toHaveLength(0);
    });

    it("shows workbook data when record groups exist regardless of kind label", () => {
      // Simulates a workbook uploaded as kind "document" but with parsed record groups
      const item = makeWorkbookItem({ kind: "document" });
      const entries = deriveDocumentSupport([item], "R-2");
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("workbook_value");
      expect(entries[0].excerpt).toContain("year");
    });
  });
});
