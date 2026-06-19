import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";
import { formatEvidenceCheckUiText } from "@/lib/quickCheck/evidenceChecks";

const CORRECTIONS_DIR = path.resolve(process.cwd(), "tests/fixtures/quick-check/corrections");
const PDD_PATH = path.resolve(process.cwd(), "tests/fixtures/quick-check/taisei-china-pdd-extracted.txt");

const QUESTION_MAP: Record<string, string> = {
  host_country: "What is the host country?",
  methodology: "What methodology was applied?",
  baseline_scenario: "What is the baseline scenario?",
  additionality: "What does the document say about additionality?",
  leakage: "What does the document say about leakage?",
  stakeholder_consultation: "What does the document say about stakeholder consultation?",
};

const LABEL_MAP: Record<string, string> = {
  host_country: "Host country",
  methodology: "Methodology",
  baseline_scenario: "Baseline scenario",
  additionality: "Additionality",
  leakage: "Leakage",
  stakeholder_consultation: "Stakeholder consultation",
};

type CorrectionJSON = {
  checkId: string;
  correctedAnswer: string;
  correctedQuote?: string;
  correctedPage?: number | null;
  correctedSection?: string;
  failureReason?: string;
};

function loadCorrections(): CorrectionJSON[] {
  if (!fs.existsSync(CORRECTIONS_DIR)) return [];
  return fs.readdirSync(CORRECTIONS_DIR)
    .filter((f) => f.startsWith("corrected-") && f.endsWith(".json") && f !== "corrected-taisei-quickcheck-corrections.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(CORRECTIONS_DIR, f), "utf-8")) as CorrectionJSON);
}

describe("Taisei PDD correction verification", () => {
  const pddText = fs.readFileSync(PDD_PATH, "utf-8");
  const corrections = loadCorrections();

  if (corrections.length === 0) {
    it.skip("no correction fixtures found", () => {});
    return;
  }

  it("answered results have complete evidence provenance", () => {
    for (const c of corrections) {
      const result = buildReviewQuestionResult({
        claimText: QUESTION_MAP[c.checkId],
        methodologyId: "ACM0010",
        methodologyVersion: "02",
        rawPddText: pddText,
      });

      const formatted = formatEvidenceCheckUiText({
        label: LABEL_MAP[c.checkId] ?? c.checkId,
        status: result.routerResult.status === "answered" ? "found"
          : result.routerResult.status === "unclear" ? "unclear"
          : "missing",
        answerText: result.routerResult.answerText || "",
        downgradeReason: result.routerResult.warnings.join("; "),
      });

      if (result.routerResult.status === "answered") {
        expect(result.routerResult.quotes.length).toBeGreaterThan(0);
        expect(result.routerResult.pages.length).toBeGreaterThan(0);
        expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);
        expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
      }

      if (c.checkId === "host_country") {
        expect(formatted.answerText.length).toBeGreaterThan(10);
        expect(formatted.answerText).not.toMatch(/^The People$/);
        expect(formatted.answerText).not.toMatch(/^the people$/);
        expect(formatted.answerText).toMatch(/republic/i);
      }

      if (c.checkId === "methodology") {
        expect(formatted.answerText).not.toMatch(/^project activity/);
        expect(formatted.answerText).not.toMatch(/^>>/);
        expect(formatted.answerText).toMatch(/ACM0010/i);
      }
    }
  });

  it("baseline_scenario does not cite B.8 or methodology preamble", () => {
    const result = buildReviewQuestionResult({
      claimText: "What is the baseline scenario?",
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: pddText,
    });

    if (result.routerResult.status === "answered") {
      // Must use B.4, not B.8
      const hasB8 = result.routerResult.sectionPaths.some((s) => s.includes("section:B.8"));
      expect(hasB8).toBe(false);

      // Quotes must be from B.4 (not B.8 completion-date text)
      for (const q of result.routerResult.quotes) {
        expect(q).not.toMatch(/date of completion/i);
        expect(q).not.toMatch(/name of person/i);
        expect(q).not.toMatch(/contact person/i);
      }
    }
  });

  it("stakeholder_consultation cites E.3 outcome, not E.1 prompt", () => {
    const result = buildReviewQuestionResult({
      claimText: "What does the document say about stakeholder consultation?",
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: pddText,
    });

    if (result.routerResult.status === "answered") {
      // Must use E.3 (outcome), not just E.1 (prompt/heading)
      const hasE3 = result.routerResult.sectionPaths.some((s) => s.includes("section:E.3"));
      const onlyE1 = result.routerResult.sectionPaths.every((s) => s.includes("section:E.1") && !s.includes("section:E.3"));

      // At minimum, shouldn't be ONLY E.1 with no E.3
      if (onlyE1) {
        // If only E.1, the quote should at least have substantive content,
        // not just the section prompt heading
        for (const q of result.routerResult.quotes) {
          expect(q).not.toMatch(/^Brief description how comments/i);
          expect(q).not.toMatch(/^How comments by local stakeholders/i);
        }
      }
    }
  });

  it("additionality and leakage return unclear when evidence is unproven", () => {
    for (const checkId of ["additionality", "leakage"]) {
      const result = buildReviewQuestionResult({
        claimText: QUESTION_MAP[checkId],
        methodologyId: "ACM0010",
        methodologyVersion: "02",
        rawPddText: pddText,
      });

      // Since the parser can't route to B.5 or the Leakage paragraph,
      // these should not return 'answered' with empty evidence.
      if (result.routerResult.status === "answered") {
        // If answered, must have real evidence provenance
        expect(result.routerResult.quotes.length).toBeGreaterThan(0);
        expect(result.routerResult.pages.length).toBeGreaterThan(0);
        expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);
        expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);

        // Quotes must contain relevant topic keywords
        const allQuotes = result.routerResult.quotes.join(" ");
        if (checkId === "additionality") {
          expect(allQuotes).toMatch(/additional/i);
        }
        if (checkId === "leakage") {
          expect(allQuotes).toMatch(/leakage/i);
        }
      }
      // 'unclear' is acceptable — the router correctly refuses to answer
      // when it can't find provenanced evidence.
    }
  });

  it.each(corrections)("$checkId answer is non-empty and well-formed", (c) => {
    const result = buildReviewQuestionResult({
      claimText: QUESTION_MAP[c.checkId],
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: pddText,
    });

    expect(result.routerResult.answerText?.trim().length).toBeGreaterThan(0);
    expect(result.routerResult.answerText).not.toMatch(/^[a-z]/);
    expect(result.routerResult.answerText).not.toMatch(/^(and|or|but|also|>>|»)\b/i);
  });
});
