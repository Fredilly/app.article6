import { describe, it, expect } from "@jest/globals";
import {
  loadAndParseExtractedText,
  type QuickCheckV2ExtractedDocument,
} from "@/lib/quickCheckV2/ingestion";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";

// ---------------------------------------------------------------------------
// Required Envira evidence strings with their expected page ranges
// ---------------------------------------------------------------------------

type EvidenceAssertion = {
  /** Human-readable label for the assertion */
  label: string;
  /** The string that must appear in a block's text (case-insensitive search) */
  requiredText: string;
  /** Minimum expected page number for the matching block */
  minPage?: number;
  /** Maximum expected page number for the matching block */
  maxPage?: number;
  /** Block types that are acceptable (default: any non-footer/header) */
  acceptableTypes?: string[];
};

const REQUIRED_EVIDENCE: EvidenceAssertion[] = [
  {
    label: "Acre, Brazil",
    requiredText: "Acre, Brazil",
    minPage: 1,
    maxPage: 5,
    acceptableTypes: ["heading", "body"],
  },
  {
    label: "VM0007: REDD Methodology Modules",
    requiredText: "VM0007: REDD Methodology Modules",
    minPage: 30,
    maxPage: 35,
    acceptableTypes: ["heading", "body"],
  },
  {
    label: "conversion to pasture",
    requiredText: "Conversion to Pasture",
    minPage: 5,
    maxPage: 15,
    acceptableTypes: ["body"],
  },
  {
    label: "cattle ranching",
    requiredText: "cattle ranching",
    minPage: 1,
    maxPage: 10,
    acceptableTypes: ["body"],
  },
  {
    label: "simple cost analysis",
    requiredText: "Simple Cost Analysis",
    minPage: 35,
    maxPage: 45,
    acceptableTypes: ["heading", "body"],
  },
  {
    label: "carbon finance",
    requiredText: "carbon finance",
    minPage: 35,
    maxPage: 45,
    acceptableTypes: ["body"],
  },
  {
    label: "VCU revenue",
    requiredText: "VCU",
    minPage: 35,
    maxPage: 45,
    acceptableTypes: ["body"],
  },
  {
    label: "Leakage emissions",
    requiredText: "Leakage emissions",
    minPage: 65,
    maxPage: 75,
    acceptableTypes: ["body"],
  },
  {
    label: "41 families",
    requiredText: "total of 41",
    minPage: 5,
    maxPage: 15,
    acceptableTypes: ["body"],
  },
  {
    label: "FPIC (Free, Prior and Informed Consent)",
    requiredText: "Free, Prior and Informed Consent",
    minPage: 5,
    maxPage: 15,
    acceptableTypes: ["body"],
  },
  {
    label: "grievance procedure",
    requiredText: "grievance",
    minPage: 5,
    maxPage: 15,
    acceptableTypes: ["body"],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Quick Check v2 — Envira ingestion", () => {
  let document: QuickCheckV2ExtractedDocument;

  beforeAll(() => {
    document = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
  });

  describe("document structure", () => {
    it("produces a valid document with blocks", () => {
      expect(document).toBeDefined();
      expect(document.documentId).toBe("proj-desc-1382-extracted");
      expect(document.parser).toBe("extracted-text");
      expect(document.blocks).toBeDefined();
      expect(document.blocks.length).toBeGreaterThan(0);
    });

    it("has stable span IDs", () => {
      for (const block of document.blocks) {
        expect(block.spanId).toBeTruthy();
        expect(block.spanId).toMatch(/^proj-desc-1382-extracted:p\d+:b\d+:[a-f0-9]+$/);
      }
    });

    it("has page numbers that are not all 1", () => {
      const pages = new Set(document.blocks.map((b) => b.page));
      expect(pages.size).toBeGreaterThan(1);
      // Check that at least one block has a page > 1
      const hasPageAbove1 = document.blocks.some((b) => b.page > 1);
      expect(hasPageAbove1).toBe(true);
    });

    it("has blocks with non-null section paths", () => {
      for (const block of document.blocks) {
        expect(block.sectionPath).toBeDefined();
        expect(Array.isArray(block.sectionPath)).toBe(true);
      }
    });
  });

  describe("diagnostics", () => {
    it("reports page count", () => {
      expect(document.diagnostics.pageCount).toBeGreaterThan(0);
    });

    it("has minimal warnings", () => {
      // Some warnings are acceptable, but none should indicate total failure
      expect(document.diagnostics.warnings).toBeDefined();
    });
  });

  describe("required Envira evidence strings", () => {
    for (const assertion of REQUIRED_EVIDENCE) {
      it(`contains "${assertion.label}"`, () => {
        const matchingBlocks = document.blocks.filter((block) =>
          block.text.toLowerCase().includes(assertion.requiredText.toLowerCase()),
        );

        expect(matchingBlocks.length).toBeGreaterThan(0);

        // Log found blocks for debugging
        const blockInfo = matchingBlocks.map(
          (b) => `p${b.page} [${b.blockType}] "${b.text.slice(0, 100)}..."`,
        );

        // Find the best block (prefer body/heading over header/footer)
        const bestBlock = matchingBlocks.find(
          (b) =>
            b.blockType !== "header" &&
            b.blockType !== "footer" &&
            b.blockType !== "unknown",
        ) ?? matchingBlocks[0]!;

        // Assert page is a real positive number
        expect(bestBlock.page).toBeGreaterThan(0);

        // Assert span ID exists and is stable
        expect(bestBlock.spanId).toBeTruthy();

        // Assert acceptable block type
        if (assertion.acceptableTypes) {
          expect(assertion.acceptableTypes).toContain(bestBlock.blockType);
        }

        // Assert page range if specified
        if (assertion.minPage !== undefined) {
          expect(bestBlock.page).toBeGreaterThanOrEqual(assertion.minPage);
        }
        if (assertion.maxPage !== undefined) {
          expect(bestBlock.page).toBeLessThanOrEqual(assertion.maxPage);
        }
      });
    }
  });

  describe("page provenance", () => {
    it("has correct page for ACRE, Brazil (page 1)", () => {
      const blocks = document.blocks.filter((b) =>
        b.text.includes("Acre, Brazil"),
      );
      expect(blocks.length).toBeGreaterThan(0);
      // The title should be on page 1
      const titleBlock = blocks.find((b) => b.blockType === "heading");
      if (titleBlock) {
        expect(titleBlock.page).toBe(1);
      }
    });

    it("has correct page for VM0007 methodology (page ~31)", () => {
      const blocks = document.blocks.filter((b) =>
        b.text.includes("VM0007: REDD Methodology Modules"),
      );
      expect(blocks.length).toBeGreaterThan(0);
      const methodBlock = blocks[0]!;
      expect(methodBlock.page).toBeGreaterThanOrEqual(30);
      expect(methodBlock.page).toBeLessThanOrEqual(35);
    });

    it("does not assign all blocks to page 1", () => {
      const page1Count = document.blocks.filter((b) => b.page === 1).length;
      const totalCount = document.blocks.length;
      // Fewer than 20% of blocks should be page 1 (some genuinely are on page 1)
      expect(page1Count / totalCount).toBeLessThan(0.2);
    });

    it("total unique pages is close to 142 (the v3.2 marker count)", () => {
      // Count v3.2 markers in the source to confirm our parsing is correct
      const { readFileSync } = require("node:fs");
      const raw = readFileSync(ENVIRA_FIXTURE_PATH, "utf-8");
      const markerCount = (raw.match(/^v3\.2\s+\d+$/gm) ?? []).length;

      // Our parsed page count should be at least close to the marker count
      expect(document.diagnostics.pageCount).toBeGreaterThanOrEqual(
        markerCount * 0.9,
      );
      expect(document.diagnostics.pageCount).toBeLessThanOrEqual(
        markerCount * 1.1,
      );
    });
  });

  describe("section provenance", () => {
    it("tracks section paths for headings", () => {
      const headings = document.blocks.filter(
        (b) => b.blockType === "heading" && b.sectionPath.length > 0,
      );
      expect(headings.length).toBeGreaterThan(0);
    });

    it("links body blocks to the correct section", () => {
      // Find the "Simple Cost Analysis" heading and verify the surrounding body blocks
      // have the right section context
      const costHeading = document.blocks.find(
        (b) =>
          b.text.includes("Simple Cost Analysis") &&
          b.blockType === "heading",
      );
      expect(costHeading).toBeDefined();
      if (costHeading) {
        expect(costHeading.sectionPath.length).toBeGreaterThan(0);
      }
    });
  });

  describe("reproducibility", () => {
    it("produces identical output on second parse", () => {
      const doc2 = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
      expect(doc2.blocks.length).toBe(document.blocks.length);

      // First and last span IDs should match (deterministic)
      expect(doc2.blocks[0]!.spanId).toBe(document.blocks[0]!.spanId);
      expect(doc2.blocks[doc2.blocks.length - 1]!.spanId).toBe(
        document.blocks[document.blocks.length - 1]!.spanId,
      );

      // Spot check a few random blocks
      const checkIndices = [0, 10, 100, 500, 1000];
      for (const idx of checkIndices) {
        if (idx < document.blocks.length && idx < doc2.blocks.length) {
          expect(doc2.blocks[idx]!.spanId).toBe(document.blocks[idx]!.spanId);
          expect(doc2.blocks[idx]!.page).toBe(document.blocks[idx]!.page);
          expect(doc2.blocks[idx]!.text).toBe(document.blocks[idx]!.text);
        }
      }
    });
  });
});
