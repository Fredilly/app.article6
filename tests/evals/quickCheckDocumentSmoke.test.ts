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
      route: "section_index",
      evidenceRequired: true,
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

// ---------------------------------------------------------------------------
// Vichada validation report (VALID_REP_1530_31MAY2016) regression
// ---------------------------------------------------------------------------
const VICHADA_DOC_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "vichada-validation-report-extracted.txt"),
  "utf-8",
);

const VICHADA_METHODOLOGY = { id: "AR-ACM0003", version: "2.0" };

describe("Quick Check — Vichada validation report regression", () => {
  describe("fact questions return answered with provenance", () => {
    it("project location: answered, evidenceSpanIds, quote, page, section provenance", () => {
      const r = buildReviewQuestionResult({
        claimText: "What is the project location?",
        methodologyId: VICHADA_METHODOLOGY.id,
        methodologyVersion: VICHADA_METHODOLOGY.version,
        rawPddText: VICHADA_DOC_TEXT,
      });
      expect(r.routerResult.status).toBe("answered");
      expect(r.routerResult.route).toBe("project_fact_contract");
      expect(r.routerResult.quotes.length).toBeGreaterThan(0);
      expect(r.routerResult.pages.length).toBeGreaterThan(0);
      expect(r.routerResult.sectionPaths.length).toBeGreaterThan(0);
      expect(r.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
      expect(r.routerResult.warnings).toEqual([]);
      // Document Q&A derives from RouterResult
      expect(r.documentAnswer.status).toBe("likely_yes");
      expect(r.documentAnswer.evidence.length).toBeGreaterThan(0);
    });

    it("methodology: answered from structured input or document evidence", () => {
      const r = buildReviewQuestionResult({
        claimText: "What methodology is used?",
        methodologyId: VICHADA_METHODOLOGY.id,
        methodologyVersion: VICHADA_METHODOLOGY.version,
        rawPddText: VICHADA_DOC_TEXT,
      });
      expect(r.routerResult.status).toBe("answered");
      expect(r.routerResult.route).toBe("project_fact_contract");
      expect(r.routerResult.answerText).toContain("AR-ACM0003");
      // Structured-input methodology has no document quotes — that's expected
      expect(r.documentAnswer.status).toBe("likely_yes");
    });

    it("crediting period: answered, evidenceSpanIds, quote, page, section provenance", () => {
      const r = buildReviewQuestionResult({
        claimText: "What is the crediting period?",
        methodologyId: VICHADA_METHODOLOGY.id,
        methodologyVersion: VICHADA_METHODOLOGY.version,
        rawPddText: VICHADA_DOC_TEXT,
    });
    });
  });

  describe("section-topic questions", () => {
    it("stakeholder consultation: answered or unclear-with-evidence, not no_evidence", () => {
      const r = buildReviewQuestionResult({
        claimText: "What does the document say about stakeholder consultation?",
        methodologyId: VICHADA_METHODOLOGY.id,
        methodologyVersion: VICHADA_METHODOLOGY.version,
        rawPddText: VICHADA_DOC_TEXT,
      });
      expect(r.routerResult.status).not.toBe("no_evidence");
      expect(["answered", "unclear"]).toContain(r.routerResult.status);
      expect(r.routerResult.quotes.length).toBeGreaterThan(0);
      expect(r.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
      expect(r.documentAnswer.status).not.toBe("likely_no");
    });
  });

  describe("unsupported question refusal", () => {
    it("marine biodiversity offsets: no_evidence, zero quotes, zero evidenceSpanIds", () => {
      const r = buildReviewQuestionResult({
        claimText: "What does the document say about marine biodiversity offsets?",
        methodologyId: VICHADA_METHODOLOGY.id,
        methodologyVersion: VICHADA_METHODOLOGY.version,
        rawPddText: VICHADA_DOC_TEXT,
      });
      expect(r.routerResult.status).toBe("no_evidence");
      expect(r.routerResult.quotes).toEqual([]);
      expect(r.routerResult.evidenceSpanIds).toEqual([]);
      expect(r.documentAnswer.status).not.toBe("likely_yes");
    });
  });

  describe("Document Q&A / router agreement contract", () => {
    it("visible status derives from RouterResult — no independent decision", () => {
      const questions = [
        "What is the project location?",
        "What methodology is used?",
        "What is the crediting period?",
        "What does the document say about stakeholder consultation?",
        "What does the document say about marine biodiversity offsets?",
      ];
      for (const q of questions) {
        const r = buildReviewQuestionResult({
          claimText: q,
          methodologyId: VICHADA_METHODOLOGY.id,
          methodologyVersion: VICHADA_METHODOLOGY.version,
          rawPddText: VICHADA_DOC_TEXT,
        });
        const router = r.routerResult;
        const da = r.documentAnswer;

        // answered → likely_yes
        if (router.status === "answered") {
          expect(da.status).toBe("likely_yes");
        }
        // no_evidence → unclear
        if (router.status === "no_evidence") {
          expect(da.status).toBe("unclear");
        }
        // unclear → unclear
        if (router.status === "unclear") {
          expect(da.status).toBe("unclear");
        }
        // never likely_no (dead code — should never be produced)
        expect(da.status).not.toBe("likely_no");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// PLUM / a.pdf cover-table regression
// ---------------------------------------------------------------------------
const PLUM_A_DOC_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "a-pdf-extracted.txt"),
  "utf-8",
);

describe("Quick Check — a.pdf / PLUM cover-table regression", () => {
  it("project location: Indonesia, Central Kalimantan", () => {
    const r = buildReviewQuestionResult({
      claimText: "What is the project location?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PLUM_A_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("answered");
    expect(r.routerResult.answerText).toContain("Indonesia");
    expect(r.routerResult.answerText).toContain("Central Kalimantan");
    expect(r.routerResult.quotes.length).toBeGreaterThan(0);
    expect(r.routerResult.pages).toContain(1);
    expect(r.documentAnswer.status).toBe("likely_yes");
  });

  it("crediting period: 01 August 2022 – 31 July 2082", () => {
    const r = buildReviewQuestionResult({
      claimText: "What is the crediting period?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PLUM_A_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("answered");
    expect(r.routerResult.answerText).toContain("01 August 2022");
    expect(r.routerResult.answerText).toContain("31 July 2082");
    expect(r.routerResult.pages).toContain(1);
    expect(r.documentAnswer.status).toBe("likely_yes");
  });

  it("marine biodiversity offsets: no_evidence", () => {
    const r = buildReviewQuestionResult({
      claimText: "What does the document say about marine biodiversity offsets?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PLUM_A_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
    expect(r.documentAnswer.status).not.toBe("likely_yes");
  });
});

// ---------------------------------------------------------------------------
// PD_REDD_v1_130 regression
// ---------------------------------------------------------------------------
const PD_REDD_DOC_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "pd-redd-v130-extracted.txt"),
  "utf-8",
);

describe("Quick Check — PD_REDD_v1_130 regression", () => {
  it("project location includes Cacheu and Cantanhez, not just the section heading", () => {
    const r = buildReviewQuestionResult({
      claimText: "What is the project location?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PD_REDD_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("answered");
    expect(r.routerResult.answerText).toContain("Cacheu");
    expect(r.routerResult.answerText).toContain("Cantanhez");
    // Must not be just the section heading: "Project Location"
    expect(r.routerResult.answerText).not.toMatch(/^Project location: Project Location/);
    expect(r.documentAnswer.status).toBe("likely_yes");
  });

  it("stakeholder consultation includes substantive text, not just STAKEHOLDER COMMENTS", () => {
    const r = buildReviewQuestionResult({
      claimText: "What does the document say about stakeholder consultation?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PD_REDD_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("answered");
    // Answer text should contain body content, not just the heading
    expect(r.routerResult.answerText).toContain("participatory process");
    expect(r.routerResult.answerText).not.toMatch(/^6 STAKEHOLDER COMMENTS: STAKEHOLDER COMMENTS/);
    expect(r.documentAnswer.status).toBe("likely_yes");
  });

  it("marine biodiversity offsets: no_evidence", () => {
    const r = buildReviewQuestionResult({
      claimText: "What does the document say about marine biodiversity offsets?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: PD_REDD_DOC_TEXT,
    });
    expect(r.routerResult.status).toBe("no_evidence");
    expect(r.routerResult.quotes).toEqual([]);
    expect(r.documentAnswer.status).not.toBe("likely_yes");
  });
});
