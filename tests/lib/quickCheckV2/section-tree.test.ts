import { describe, it, expect } from "@jest/globals";
import {
  loadAndParseExtractedText,
  type QuickCheckV2ExtractedDocument,
} from "@/lib/quickCheckV2/ingestion";
import {
  buildSectionTree,
  buildEvidenceIndex,
  type SectionTreeNode,
  type CheckEvidenceResult,
} from "@/lib/quickCheckV2/section-tree";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/envira/extracted.txt";
const ENVIRA_DOCUMENT_ID = "proj-desc-1382-extracted";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all nodes in the tree recursively */
function getAllNodes(tree: SectionTreeNode[]): SectionTreeNode[] {
  const result: SectionTreeNode[] = [];
  function walk(nodes: SectionTreeNode[]): void {
    for (const n of nodes) {
      result.push(n);
      walk(n.children);
    }
  }
  walk(tree);
  return result;
}

/** Find the first node whose text contains the given substring */
function findNodeByText(
  tree: SectionTreeNode[],
  substring: string,
): SectionTreeNode | undefined {
  return getAllNodes(tree).find((n) =>
    n.heading.text.toLowerCase().includes(substring.toLowerCase()),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Quick Check v2 — section tree", () => {
  let doc: QuickCheckV2ExtractedDocument;
  let tree: SectionTreeNode[];

  beforeAll(() => {
    doc = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH, ENVIRA_DOCUMENT_ID);
    tree = buildSectionTree(doc);
  });

  describe("tree structure", () => {
    it("builds a non-empty tree", () => {
      expect(tree.length).toBeGreaterThan(0);
    });

    it("has the Envira title as the first root node", () => {
      expect(tree[0]!.heading.text).toContain("ENVIRA AMAZONIA");
    });

    it("contains the six main VCS headings somewhere in the tree", () => {
      const texts = getAllNodes(tree).map((n) => n.heading.text.trim());
      expect(texts.some((t) => t.startsWith("1 PROJECT DETAILS"))).toBe(true);
      expect(texts.some((t) => t.startsWith("2 APPLICATION OF METHODOLOGY"))).toBe(true);
      expect(texts.some((t) => t.startsWith("3 QUANTIFICATION"))).toBe(true);
      expect(texts.some((t) => t.startsWith("4 MONITORING"))).toBe(true);
      expect(texts.some((t) => t.startsWith("5 ENVIRONMENTAL IMPACT"))).toBe(true);
      expect(texts.some((t) => t.startsWith("6 STAKEHOLDER COMMENTS"))).toBe(true);
    });

    it("direct body blocks exist under real content section for 2.1 (methodology, P31)", () => {
      const nodes = getAllNodes(tree);
      const section21 = nodes.find(
        (n) =>
          n.heading.text.startsWith("2.1 Title") && n.heading.page >= 30,
      );
      expect(section21).toBeDefined();
      expect(section21!.directBodyBlocks.length).toBeGreaterThan(0);
      const bodyTexts = section21!.directBodyBlocks.map((b) => b.text).join(" ");
      expect(bodyTexts).toContain("VM0007");
    });

    it("direct body blocks exist under real content section for 2.4 Baseline Scenario (P37)", () => {
      const nodes = getAllNodes(tree);
      const section24 = nodes.find(
        (n) =>
          n.heading.text.startsWith("2.4 Baseline") && n.heading.page >= 35,
      );
      expect(section24).toBeDefined();
      expect(section24!.directBodyBlocks.length).toBeGreaterThan(0);
    });

    it("direct body blocks exist under real content section for 3.3 Leakage (P69)", () => {
      const nodes = getAllNodes(tree);
      const section33 = nodes.find(
        (n) => n.heading.text.startsWith("3.3 Leakage") && n.heading.page >= 65,
      );
      expect(section33).toBeDefined();
      expect(section33!.directBodyBlocks.length).toBeGreaterThan(0);
    });

    it("no descendant sweeping — TOC sections (P2) have no body blocks", () => {
      // The TOC entry for 2.1 on page 2 should have no body blocks
      // (it's just a TOC line, not actual content)
      const nodes = getAllNodes(tree);
      const tocSection21 = nodes.find(
        (n) =>
          n.heading.text.startsWith("2.1 Title") && n.heading.page === 2,
      );
      if (tocSection21) {
        expect(tocSection21.directBodyBlocks.length).toBe(0);
      }
    });

    it("real content section 2.5 Additionality (P38) has its own intro body blocks", () => {
      // Section 2.5 direct body should be the intro paragraph, not the detailed
      // analysis which lives under 2.5.1 (Simple Cost Analysis)
      const nodes = getAllNodes(tree);
      const section25 = nodes.find(
        (n) =>
          n.heading.text.startsWith("2.5 Additionality") && n.heading.page >= 36,
      );
      expect(section25).toBeDefined();
      const bodyTexts = section25!.directBodyBlocks.map((b) => b.text);
      expect(bodyTexts.length).toBeGreaterThan(0);

      // The subsection 2.5.1 should have its own body blocks
      const section251 = nodes.find(
        (n) => n.heading.text.startsWith("2.5.1 Simple Cost Analysis"),
      );
      expect(section251).toBeDefined();
      expect(section251!.directBodyBlocks.length).toBeGreaterThan(0);
    });
  });
});

describe("Quick Check v2 — evidence span index", () => {
  let doc: QuickCheckV2ExtractedDocument;
  let evidence: CheckEvidenceResult[];

  beforeAll(() => {
    doc = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH, ENVIRA_DOCUMENT_ID);
    evidence = buildEvidenceIndex(doc);
  });

  it("returns results for all six checks", () => {
    const checkNames = evidence.map((e) => e.checkName);
    expect(checkNames).toStrictEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
  });

  describe("host_country", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "host_country")!; });

    it("finds evidence", () => {
      expect(result.span).not.toBeNull();
    });

    it("returns correct section heading", () => {
      expect(result.span!.sectionHeading).toContain("Project Location");
    });

    it("contains 'Acre, Brazil' or country reference", () => {
      expect(result.span!.quote).toMatch(/Acre.*Brazil|Brazil/);
    });

    it("has full provenance (page, sectionPath, spanId)", () => {
      expect(result.span!.page).toBeGreaterThan(0);
      expect(result.span!.sectionPath.length).toBeGreaterThan(0);
      expect(result.span!.spanId).toMatch(/^proj-desc-1382-extracted:/);
    });
  });

  describe("methodology", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "methodology")!; });

    it("finds evidence", () => {
      expect(result.span).not.toBeNull();
    });

    it("returns correct section heading", () => {
      expect(result.span!.sectionHeading).toContain("Title and Reference of Methodology");
    });

    it("contains 'VCS REDD Methodology' reference", () => {
      // The first body block under methodology is the intro sentence
      // which names the methodology framework but not the module number
      expect(result.span!.quote).toMatch(/REDD Methodology|Methodology/i);
    });

    it("is on page ~31", () => {
      expect(result.span!.page).toBeGreaterThanOrEqual(30);
      expect(result.span!.page).toBeLessThanOrEqual(35);
    });
  });

  describe("baseline_scenario", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "baseline_scenario")!; });

    it("finds evidence", () => { expect(result.span).not.toBeNull(); });
    it("returns correct section", () => { expect(result.span!.sectionHeading).toContain("Baseline Scenario"); });
    it("is on page ~37", () => {
      expect(result.span!.page).toBeGreaterThanOrEqual(35);
      expect(result.span!.page).toBeLessThanOrEqual(40);
    });
  });

  describe("additionality", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "additionality")!; });

    it("finds evidence", () => { expect(result.span).not.toBeNull(); });
    it("returns correct section", () => { expect(result.span!.sectionHeading).toContain("Additionality"); });
    it("is on page ~38", () => {
      expect(result.span!.page).toBeGreaterThanOrEqual(36);
      expect(result.span!.page).toBeLessThanOrEqual(42);
    });
  });

  describe("leakage", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "leakage")!; });

    it("finds evidence", () => { expect(result.span).not.toBeNull(); });

    it("returns 3.3 Leakage (not 2.3.1)", () => {
      expect(result.span!.sectionHeading).toContain("Leakage");
      expect(result.span!.sectionHeading).not.toContain("Baseline, Project and Leakage");
    });

    it("is on page ~69", () => {
      expect(result.span!.page).toBeGreaterThanOrEqual(65);
      expect(result.span!.page).toBeLessThanOrEqual(75);
    });
  });

  describe("stakeholder_consultation", () => {
    let result: CheckEvidenceResult;
    beforeAll(() => { result = evidence.find((e) => e.checkName === "stakeholder_consultation")!; });

    it("finds evidence", () => { expect(result.span).not.toBeNull(); });
    it("returns correct section", () => {
      expect(result.span!.sectionHeading).toContain("STAKEHOLDER COMMENTS");
    });
    it("is on page ~122", () => {
      expect(result.span!.page).toBeGreaterThanOrEqual(120);
      expect(result.span!.page).toBeLessThanOrEqual(126);
    });
  });

  describe("no answer extraction or status", () => {
    it("evidence span has no answer/status/score fields", () => {
      for (const r of evidence) {
        if (r.span) {
          expect(Object.keys(r.span)).not.toContain("answer");
          expect(Object.keys(r.span)).not.toContain("status");
          expect(Object.keys(r.span)).not.toContain("score");
        }
      }
    });

    it("check result has no status or answer fields", () => {
      for (const r of evidence) {
        expect(Object.keys(r)).not.toContain("status");
        expect(Object.keys(r)).not.toContain("answer");
      }
    });
  });

  describe("reproducibility", () => {
    it("produces identical evidence on second run", () => {
      const ev2 = buildEvidenceIndex(doc);
      expect(ev2.length).toBe(evidence.length);
      for (let i = 0; i < evidence.length; i++) {
        expect(ev2[i]!.checkName).toBe(evidence[i]!.checkName);
        if (evidence[i]!.span && ev2[i]!.span) {
          expect(ev2[i]!.span!.spanId).toBe(evidence[i]!.span!.spanId);
          expect(ev2[i]!.span!.page).toBe(evidence[i]!.span!.page);
          expect(ev2[i]!.span!.quote).toBe(evidence[i]!.span!.quote);
        }
      }
    });
  });
});
