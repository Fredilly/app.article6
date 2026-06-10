/**
 * Quick Check raw-document text QA pipeline smoke test.
 *
 * This is NOT a live upload / browser integration test. It does NOT exercise:
 *   - PDF upload
 *   - PDF extraction (pdf-parse / heuristic)
 *   - Browser UI (QuickCheckPanel, React rendering)
 *   - Uploaded-document session state (localStorage, attachments)
 *   - Technical details fetch (methodology rules retrieval over HTTP)
 *
 * It directly calls buildReviewQuestionResult() with a static text fixture
 * to validate that the core QA routing pipeline produces correct answer or
 * rejection signals for a small set of canonical Quick Check questions.
 *
 * Purpose: fast (<5s) sanity check that the raw-text router, fact extractor,
 * and section indexer work end-to-end before heavier eval corpus or
 * component-level tests run.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/quick-check");
const SMOKE_DOC_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "plum-pdd-regression.txt"),
  "utf-8",
);

describe("Quick Check raw document text smoke test", () => {
  const questions = [
    {
      id: "project_title",
      claimText: "What is the project title?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    {
      id: "methodology",
      claimText: "What methodology is used for this project?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    {
      id: "host_country",
      claimText: "What is the host country?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    {
      id: "monitoring",
      claimText: "Explain the monitoring plan.",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    {
      id: "marine_biodiversity_offsets",
      claimText: "Does the document address marine biodiversity offsets?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
    {
      id: "blue_carbon_mangrove",
      claimText: "What does this document say about blue carbon mangrove restoration?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    },
  ];

  const expected: Record<string, {
    status: "answered" | "unclear" | "no_evidence";
    route?: string;
    evidenceRequired?: boolean;
    emptyEvidence?: boolean;
    warningsInclude?: string[];
  }> = {
    project_title: {
      status: "answered",
      route: "project_fact_contract",
      evidenceRequired: true,
    },
    methodology: {
      status: "answered",
      route: "project_fact_contract",
      evidenceRequired: true,
    },
    host_country: {
      status: "no_evidence",
      route: "fallback",
      emptyEvidence: true,
    },
    monitoring: {
      status: "answered",
      route: "lexical_retrieval",
      emptyEvidence: false,
    },
    marine_biodiversity_offsets: {
      status: "no_evidence",
      route: "fallback",
      emptyEvidence: true,
      warningsInclude: ["unsupported_or_out_of_scope"],
    },
    blue_carbon_mangrove: {
      status: "no_evidence",
      route: "fallback",
      emptyEvidence: true,
      warningsInclude: ["unsupported_or_out_of_scope"],
    },
  };

  for (const q of questions) {
    it(`answers or correctly rejects: ${q.id}`, () => {
      const result = buildReviewQuestionResult({
        claimText: q.claimText,
        methodologyId: q.methodologyId,
        methodologyVersion: q.methodologyVersion,
        rawPddText: SMOKE_DOC_TEXT,
      });

      const router = result.routerResult;
      const exp = expected[q.id];

      expect(router.status).toBe(exp.status);

      if (exp.route) {
        expect(router.route).toBe(exp.route);
      }

      if (exp.evidenceRequired) {
        expect(router.quotes.length).toBeGreaterThan(0);
        expect(router.pages.length).toBeGreaterThan(0);
      }

      if (exp.emptyEvidence) {
        expect(router.quotes).toEqual([]);
        expect(router.pages).toEqual([]);
        expect(router.sectionPaths).toEqual([]);
      }

      if (exp.warningsInclude) {
        expect(router.warnings).toEqual(
          expect.arrayContaining(exp.warningsInclude),
        );
      }

      expect(Array.isArray(router.evidenceSpanIds)).toBe(true);
      expect(Array.isArray(router.quotes)).toBe(true);
      expect(Array.isArray(router.pages)).toBe(true);
      expect(Array.isArray(router.sectionPaths)).toBe(true);
      expect(Array.isArray(router.warnings)).toBe(true);
    });
  }

  it("all six questions produce valid router results", () => {
    const statuses = new Set(
      questions.map((q) => {
        const result = buildReviewQuestionResult({
          claimText: q.claimText,
          methodologyId: q.methodologyId,
          methodologyVersion: q.methodologyVersion,
          rawPddText: SMOKE_DOC_TEXT,
        });
        return result.routerResult.status;
      }),
    );

    // At least one question answered and at least one correctly rejected
    expect(statuses.has("answered")).toBe(true);
    expect(statuses.has("no_evidence")).toBe(true);

    for (const q of questions) {
      const result = buildReviewQuestionResult({
        claimText: q.claimText,
        methodologyId: q.methodologyId,
        methodologyVersion: q.methodologyVersion,
        rawPddText: SMOKE_DOC_TEXT,
      });
      expect(result.routerResult).toBeDefined();
      expect(typeof result.routerResult.status).toBe("string");
      expect(["answered", "unclear", "no_evidence"]).toContain(result.routerResult.status);
    }
  });
});
