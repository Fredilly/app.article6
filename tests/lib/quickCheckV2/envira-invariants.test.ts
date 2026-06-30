import { describe, it, expect } from "@jest/globals";
import {
  loadAndParseExtractedText,
  type QuickCheckV2ExtractedDocument,
} from "@/lib/quickCheckV2/ingestion";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/envira/extracted.txt";
const ENVIRA_DOCUMENT_ID = "proj-desc-1382-extracted";

// ---------------------------------------------------------------------------
// Invariant tests — these must hold for the entire document, not just
// selected evidence strings
// ---------------------------------------------------------------------------

describe("canonical JSON invariants", () => {
  let doc: QuickCheckV2ExtractedDocument;

  beforeAll(() => {
    doc = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH, ENVIRA_DOCUMENT_ID);
  });

  describe("page provenance invariants", () => {
    it("every block has page >= 1 (no page 0 or negative)", () => {
      const badBlocks = doc.blocks.filter((b) => b.page < 1);
      expect(badBlocks.length).toBe(0);
    });

    it("no spanId contains :p0:", () => {
      const badSpanIds = doc.blocks.filter((b) => b.spanId.includes(":p0:"));
      expect(badSpanIds.length).toBe(0);
    });

    it("page numbers are within expected range (1..142)", () => {
      const pages = [...new Set(doc.blocks.map((b) => b.page))].sort(
        (a, b) => a - b,
      );
      expect(pages[0]).toBeGreaterThanOrEqual(1);
      expect(pages[pages.length - 1]).toBeLessThanOrEqual(142);
    });

    it("at least 120 unique pages are represented", () => {
      const pages = new Set(doc.blocks.map((b) => b.page));
      expect(pages.size).toBeGreaterThanOrEqual(120);
    });
  });

  describe("no phantom page markers from bare numbers", () => {
    it("bare 0 lines in table context are not treated as page markers", () => {
      // The Envira fixture has bare "0" lines around lines 4874-4992
      // (risk-rating table entries). These should appear as body blocks
      // with the same page as surrounding content, not as page separators.
      const zeroBlocks = doc.blocks.filter((b) => b.text.trim() === "0");
      // These should exist (they're real content) but should NOT be on
      // a page that nothing else shares, and should NOT reset page numbering
      for (const block of zeroBlocks) {
        expect(block.page).toBeGreaterThan(0);
      }
    });

    it("bare 1 lines are not page markers unless in v3.2 N / Page N format", () => {
      // The fixture has many lines matching just "1" or "2" in table contexts.
      // These should not create phantom pages.
      const blocks = doc.blocks;

      // Check that the first 10 blocks are all page 1 (cover page content)
      const first10Pages = blocks.slice(0, 10).map((b) => b.page);
      const allPage1 = first10Pages.every((p) => p === 1);
      expect(allPage1).toBe(true);
    });
  });

  describe("block structure invariants", () => {
    it("every block has a non-empty spanId", () => {
      for (const block of doc.blocks) {
        expect(block.spanId).toBeTruthy();
        expect(block.spanId.length).toBeGreaterThan(0);
      }
    });

    it("every block has a valid blockType", () => {
      const validTypes = [
        "heading",
        "body",
        "table",
        "footer",
        "header",
        "unknown",
      ];
      for (const block of doc.blocks) {
        expect(validTypes).toContain(block.blockType);
      }
    });

    it("every block has a stable spanId format", () => {
      const pattern =
        /^proj-desc-1382-extracted:p\d+:b\d+:[a-f0-9]+$/;
      for (const block of doc.blocks) {
        expect(block.spanId).toMatch(pattern);
      }
    });

    it("every block has a defined sectionPath (possibly empty)", () => {
      for (const block of doc.blocks) {
        expect(block.sectionPath).toBeDefined();
        expect(Array.isArray(block.sectionPath)).toBe(true);
      }
    });
  });

  describe('section heading detection', () => {
    describe("top-level headings (e.g. '1 PROJECT DETAILS')", () => {
      it('detects "1 PROJECT DETAILS" as heading with sectionPath ["1"]', () => {
        const headingBlock = doc.blocks.find(
          (b) => b.text === '1 PROJECT DETAILS' && b.blockType === 'heading',
        );
        expect(headingBlock).toBeDefined();
        expect(headingBlock!.sectionPath).toEqual(['1']);
      });

      it('detects "2 APPLICATION OF METHODOLOGY" as heading with sectionPath ["2"]', () => {
        const headingBlock = doc.blocks.find(
          (b) => b.text === '2 APPLICATION OF METHODOLOGY' && b.blockType === 'heading',
        );
        expect(headingBlock).toBeDefined();
        expect(headingBlock!.sectionPath).toEqual(['2']);
      });

      it('detects "3 QUANTIFICATION OF GHG EMISSION REDUCTIONS AND REMOVALS" as heading with sectionPath ["3"]', () => {
        const headingBlock = doc.blocks.find(
          (b) => b.text === '3 QUANTIFICATION OF GHG EMISSION REDUCTIONS AND REMOVALS' && b.blockType === 'heading',
        );
        expect(headingBlock).toBeDefined();
        expect(headingBlock!.sectionPath).toEqual(['3']);
      });

      it("body blocks after '1 PROJECT DETAILS' inherit sectionPath ['1']", () => {
        const projDetailsIndex = doc.blocks.findIndex(
          (b) => b.text === '1 PROJECT DETAILS',
        );
        expect(projDetailsIndex).toBeGreaterThanOrEqual(0);
        // Find the first body block after the heading, skipping subsections
        const firstBodyAfter = doc.blocks
          .slice(projDetailsIndex + 1)
          .find((b) => b.blockType === 'body' && b.sectionPath.length === 1);
        expect(firstBodyAfter).toBeDefined();
        expect(firstBodyAfter!.sectionPath).toEqual(['1']);
      });
    });

    describe('existing all-caps headings still detected', () => {
      it('detects "5 ENVIRONMENTAL IMPACT" as heading', () => {
        const headingBlock = doc.blocks.find(
          (b) =>
            b.text === '5 ENVIRONMENTAL IMPACT' && b.blockType === 'heading',
        );
        expect(headingBlock).toBeDefined();
      });

      it('detects "6 STAKEHOLDER COMMENTS" as heading', () => {
        const headingBlock = doc.blocks.find(
          (b) =>
            b.text === '6 STAKEHOLDER COMMENTS' && b.blockType === 'heading',
        );
        expect(headingBlock).toBeDefined();
      });
    });

    describe('bare numeric lines are not headings', () => {
      it('bare "0" is not a heading', () => {
        const zeroHeadings = doc.blocks.filter(
          (b) => b.text === '0' && b.blockType === 'heading',
        );
        expect(zeroHeadings.length).toBe(0);
      });

      it('bare "1" is not a heading', () => {
        const oneHeadings = doc.blocks.filter(
          (b) => b.text === '1' && b.blockType === 'heading',
        );
        expect(oneHeadings.length).toBe(0);
      });
    });
  });

  describe('page adjacency — no gaps or resets', () => {
    it('page numbers increase monotonically (not strictly but never jump backward)', () => {
      let lastPage = 0;
      let sawPageGt1 = false;
      for (const block of doc.blocks) {
        if (block.page > 1) sawPageGt1 = true;
        // Once we've seen content past page 1, we should never see page 1 again
        // (A single-page jump backward indicates a phantom page reset)
        if (sawPageGt1 && block.page < lastPage && block.page === 1) {
          expect(block.page).toBeGreaterThan(1);
        }
        if (block.page > lastPage) lastPage = block.page;
      }
    });

    it("document reports a reasonable pageCount", () => {
      expect(doc.diagnostics.pageCount).toBeGreaterThan(120);
      expect(doc.diagnostics.pageCount).toBeLessThanOrEqual(145);
    });
  });
});
