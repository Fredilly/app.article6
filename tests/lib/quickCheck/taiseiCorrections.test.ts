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

  // Rule: answered results must have non-empty quotes, pages, sections, evidenceSpanIds
  it("answered results must have complete evidence provenance", () => {
    for (const c of corrections) {
      const question = QUESTION_MAP[c.checkId];
      const result = buildReviewQuestionResult({
        claimText: question,
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

      // If the router answered, evidence must be present
      if (result.routerResult.status === "answered") {
        expect(result.routerResult.quotes.length).toBeGreaterThan(0);
        expect(result.routerResult.pages.length).toBeGreaterThan(0);
        expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);
        expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
      }

      // host_country specific: answer must not be a truncated fragment
      if (c.checkId === "host_country") {
        expect(formatted.answerText.length).toBeGreaterThan(10);
        expect(formatted.answerText).not.toMatch(/^The People$/);
        expect(formatted.answerText).not.toMatch(/^the people$/);
      }

      // methodology specific: answer must not have noisy prefixes
      if (c.checkId === "methodology") {
        expect(formatted.answerText).not.toMatch(/^project activity/);
        expect(formatted.answerText).not.toMatch(/^>>/);
      }

      // baseline_scenario specific: answer must not cite B.8
      if (c.checkId === "baseline_scenario") {
        if (result.routerResult.status === "answered") {
          const hasB8 = result.routerResult.sectionPaths.some((s) => s.includes("section:B.8"));
          expect(hasB8).toBe(false);
        }
      }

      // stakeholder_consultation specific: must not be a table dump
      if (c.checkId === "stakeholder_consultation") {
        if (result.routerResult.status === "answered") {
          expect(formatted.answerText).not.toMatch(/^\s*>>/);
          expect(formatted.answerText.length).toBeLessThan(500);
        }
      }
    }
  });

  it.each(corrections)("$checkId produces a meaningful answer", (c) => {
    const question = QUESTION_MAP[c.checkId];
    if (!question) throw new Error(`No question mapping for ${c.checkId}`);

    const result = buildReviewQuestionResult({
      claimText: question,
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: pddText,
    });

    // Answer must be non-empty
    expect(result.routerResult.answerText?.trim().length).toBeGreaterThan(0);

    // Answer must not start with connector fragments or mid-word
    expect(result.routerResult.answerText).not.toMatch(/^[a-z]/);
    expect(result.routerResult.answerText).not.toMatch(/^(and|or|but|also|>>|»)\b/i);
  });
});
