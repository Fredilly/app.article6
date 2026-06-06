import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";
import { compileEvidenceDocument } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { routeGroundedQuestion } from "@/lib/quickCheck/retrieval/groundedRetrievalRouter";

type EvalExpectation = {
  answerIncludes?: string | null;
  route?: "fact_lookup" | "section_lookup" | "lexical_retrieval" | "fallback";
  status?: "answered" | "unclear" | "no_evidence";
  evidenceSectionIncludes?: string[];
};

type EvalCase = {
  fixture: string;
  questions: Record<string, EvalExpectation>;
};

function fixture(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check", name), "utf8");
}

const EVAL_CASES: EvalCase[] = [
  {
    fixture: "cdm-energy-pdd-extracted.txt",
    questions: {
      "What is the project title?": { answerIncludes: "Nyota Small Hydro Project", route: "fact_lookup", status: "answered" },
      "What is the host country?": { answerIncludes: "Uganda", route: "fact_lookup", status: "answered" },
      "What methodology is used?": { answerIncludes: "ACM0002", route: "fact_lookup", status: "answered" },
      "What is the baseline scenario?": { answerIncludes: "Baseline scenario", evidenceSectionIncludes: ["2.1"] },
      "What does the document say about monitoring?": { answerIncludes: "Monitoring", evidenceSectionIncludes: ["4.1"] },
      "What does the document say about leakage?": { answerIncludes: "Leakage", evidenceSectionIncludes: ["3.1"] },
      "What does the document say about additionality?": { answerIncludes: "additional", evidenceSectionIncludes: ["2.2"] },
      "What does the document say about an unsupported topic?": { route: "fallback", status: "no_evidence", answerIncludes: null },
    },
  },
  {
    fixture: "verra-project-facts-extracted.txt",
    questions: {
      "What is the project title?": { answerIncludes: "Madre de Dios Forest Conservation Project", route: "fact_lookup", status: "answered" },
      "What is the host country?": { answerIncludes: "Peru", route: "fact_lookup", status: "answered" },
      "What methodology is used?": { answerIncludes: "VM0007", route: "fact_lookup", status: "answered" },
      "What is the baseline scenario?": { answerIncludes: "Baseline scenario", evidenceSectionIncludes: ["2.4"] },
      "What does the document say about monitoring?": { answerIncludes: "Monitoring", evidenceSectionIncludes: ["3.3"] },
      "What does the document say about leakage?": { answerIncludes: "Leakage", evidenceSectionIncludes: ["3.4"] },
      "What does the document say about additionality?": { answerIncludes: "additional", evidenceSectionIncludes: ["2.5"] },
      "What does the document say about an unsupported topic?": { route: "fallback", status: "no_evidence", answerIncludes: null },
    },
  },
  {
    fixture: "pd_redd_v1_130-extracted.txt",
    questions: {
      "What is the project title?": { route: "fallback", status: "no_evidence", answerIncludes: null },
      "What is the host country?": { route: "fallback", status: "no_evidence", answerIncludes: null },
      "What methodology is used?": { answerIncludes: "VM0007", route: "fact_lookup", status: "answered" },
      "What is the baseline scenario?": { answerIncludes: "Baseline scenario", evidenceSectionIncludes: ["2.4"] },
      "What does the document say about monitoring?": { answerIncludes: "Monitoring", evidenceSectionIncludes: ["3.3"] },
      "What does the document say about leakage?": { answerIncludes: "Leakage", evidenceSectionIncludes: ["1.10"] },
      "What does the document say about additionality?": { answerIncludes: "additional", evidenceSectionIncludes: ["2.5"] },
      "What does the document say about an unsupported topic?": { route: "fallback", status: "no_evidence", answerIncludes: null },
    },
  },
  {
    fixture: "rimba-raya-fallback.txt",
    questions: {
      "What is the project title?": { answerIncludes: "Rimba Raya Biodiversity Reserve Project", route: "fact_lookup", status: "answered" },
      "What is the host country?": { answerIncludes: "Indonesia", route: "fact_lookup", status: "answered" },
      "What methodology is used?": { answerIncludes: "VM0004", route: "fact_lookup", status: "answered" },
      "What is the baseline scenario?": { answerIncludes: "baseline scenario", status: "answered" },
      "What does the document say about monitoring?": { answerIncludes: "monitoring plan", status: "answered" },
      "What does the document say about leakage?": { answerIncludes: "Leakage management", status: "answered" },
      "What does the document say about additionality?": { answerIncludes: "additional", status: "answered" },
      "What does the document say about an unsupported topic?": { route: "fallback", status: "no_evidence", answerIncludes: null },
    },
  },
];

describe("grounded retrieval router eval", () => {
  for (const evalCase of EVAL_CASES) {
    const document = compileEvidenceDocument({
      docId: evalCase.fixture,
      rawText: fixture(evalCase.fixture),
    });

    test(`runs the shared question set for ${evalCase.fixture}`, () => {
      for (const [question, expected] of Object.entries(evalCase.questions)) {
        const result = routeGroundedQuestion({ document, question });

        if (expected.route) expect(result.route).toBe(expected.route);
        if (expected.status) expect(result.status).toBe(expected.status);
        if (expected.answerIncludes === null) {
          expect(result.answerText).toBeNull();
        } else if (expected.answerIncludes) {
          expect((result.answerText ?? "").toLowerCase()).toContain(expected.answerIncludes.toLowerCase());
        }
        if (expected.evidenceSectionIncludes?.length) {
          for (const sectionId of expected.evidenceSectionIncludes) {
            expect(result.evidence.some((item) => (item.sectionId ?? "").startsWith(sectionId))).toBe(true);
          }
        }
        if (result.status !== "no_evidence") {
          expect(result.evidence.length).toBeGreaterThan(0);
          expect(result.evidence.every((item) => item.spanId.length > 0)).toBe(true);
        }
      }
    });
  }
});
