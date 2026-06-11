import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildEvidenceSpanIndex } from "@/lib/quickCheck/evidence/buildEvidenceSpanIndex";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { EvidenceSpanQuery } from "@/lib/quickCheck/evidence/evidenceSpanIndex";

function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/quick-check", name),
    "utf-8",
  );
}

describe("EvidenceSpanIndex — in-memory implementation", () => {
  const CDM_TEXT = readFixture("bsp-nepal-activity3-cdm-excerpt.txt");
  const ctx = getStructuredQueryContext(CDM_TEXT);
  const index = buildEvidenceSpanIndex({
    evidenceDocument: ctx.evidenceDocument,
    projectFactContract: ctx.projectFactContract,
    sectionTableIndex: ctx.sectionTableIndex,
  });

  describe("fact lookup", () => {
    it("returns candidates for a known hostCountry fact", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What is the host country?",
        reviewArea: "general",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "fact_lookup",
        targetFacts: ["hostCountry"],
      };
      const results = index.query(q);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchReason).toBe("fact");
      expect(results[0].text).toContain("Nepal");
      expect(results[0].pageNumbers.length).toBeGreaterThan(0);
    });

    it("preserves provenance (page numbers, section path)", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What is the project title?",
        reviewArea: "general",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "fact_lookup",
        targetFacts: ["projectTitle"],
      };
      const results = index.query(q);
      expect(results.length).toBeGreaterThan(0);
      const c = results[0];
      expect(c.evidenceSpanId).toBeTruthy();
      expect(c.pageNumbers).toBeInstanceOf(Array);
      expect(c.sectionPath).toBeInstanceOf(Array);
      expect(c.blockType).toBeTruthy();
      expect(c.text).toContain("Biogas");
    });

    it("returns empty for an unsupported fact", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What is the stock price?",
        reviewArea: "general",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "fact_lookup",
        targetFacts: ["projectStartDate"],
      };
      const results = index.query(q);
      // CDM fixture has no projectStartDate evidence
      expect(results.length).toBe(0);
    });

    it("sorts candidates by confidence (high > medium > low)", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What methodology is used?",
        reviewArea: "general",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "fact_lookup",
        targetFacts: ["methodologyPrimary"],
        maxCandidates: 3,
      };
      const results = index.query(q);
      // deterministic: higher score first
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe("section lookup", () => {
    it("returns candidates for a known section", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What does the document say about monitoring?",
        reviewArea: "monitoring",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "section_topic",
        targetSections: ["section:D.1"],
      };
      const results = index.query(q);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchReason).toBe("section");
    });

    it("preserves heading and topic tags from section", () => {
      const q: EvidenceSpanQuery = {
        claimText: "Explain the baseline scenario.",
        reviewArea: "baseline",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "section_topic",
        targetSections: ["section:B.4"],
      };
      const results = index.query(q);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].topicTags.length).toBeGreaterThan(0);
    });

    it("returns empty for a non-existent section", () => {
      const q: EvidenceSpanQuery = {
        claimText: "test",
        reviewArea: "general",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        intent: "section_topic",
        targetSections: ["section:nonexistent"],
      };
      expect(index.query(q)).toEqual([]);
    });
  });

  describe("lexical lookup", () => {
    it("finds spans containing claim keywords", () => {
      const q: EvidenceSpanQuery = {
        claimText: "Explain the monitoring plan.",
        reviewArea: "monitoring",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
      };
      const results = index.query(q);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchReason).toBe("lexical");
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("filters out footer, header, and toc block types", () => {
      const q: EvidenceSpanQuery = {
        claimText: "Explain the monitoring plan.",
        reviewArea: "monitoring",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
      };
      const results = index.query(q);
      for (const c of results) {
        expect(c.blockType).not.toBe("footer");
        expect(c.blockType).not.toBe("header");
        expect(c.blockType).not.toBe("toc");
      }
    });
  });

  describe("deterministic ordering", () => {
    it("same query produces same results in the same order", () => {
      const q: EvidenceSpanQuery = {
        claimText: "What does the document say about leakage?",
        reviewArea: "leakage",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
      };
      const a = index.query(q);
      const b = index.query(q);
      expect(a).toEqual(b);
    });

    it("lexical results sort by score descending", () => {
      const q: EvidenceSpanQuery = {
        claimText: "monitoring",
        reviewArea: "monitoring",
        methodologyId: "AMS-I.E.",
        methodologyVersion: "1.0",
        maxCandidates: 10,
      };
      const results = index.query(q);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });
});
