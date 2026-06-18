import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";
import { formatEvidenceCheckUiText } from "@/lib/quickCheck/evidenceChecks";

const CORRECTIONS_DIR = path.resolve(process.cwd(), "tests/fixtures/quick-check/corrections");
const FIXTURE_TEXT_DIR = path.resolve(process.cwd(), "tests/fixtures/quick-check");

type CorrectionEntry = {
  documentId: string;
  documentName: string;
  documentType: string;
  methodologyId: string;
  checkId: string;
  correctedAnswer: string;
  correctedQuote?: string;
  correctedPage?: number | null;
  correctedSection?: string;
  confidence?: number;
  failureReason?: string;
};

type CheckQuestion = {
  id: string;
  question: string;
};

const CHECK_QUESTIONS: Record<string, CheckQuestion> = {
  host_country: { id: "host_country", question: "What is the host country?" },
  methodology: { id: "methodology", question: "What methodology was applied?" },
  baseline_scenario: { id: "baseline_scenario", question: "What is the baseline scenario?" },
  additionality: { id: "additionality", question: "What does the document say about additionality?" },
  leakage: { id: "leakage", question: "What does the document say about leakage?" },
  stakeholder_consultation: { id: "stakeholder_consultation", question: "What does the document say about stakeholder consultation?" },
  project_title: { id: "project_title", question: "What is the project title?" },
};

// Maps correction documentIds to raw PDD fixture files
const DOCUMENT_FIXTURES: Record<string, string> = {
  "taisei-china-pdd": "taisei-china-pdd-extracted.txt",
};

function loadCorrections(): CorrectionEntry[] {
  const entries: CorrectionEntry[] = [];
  if (!fs.existsSync(CORRECTIONS_DIR)) return entries;

  for (const file of fs.readdirSync(CORRECTIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(CORRECTIONS_DIR, file), "utf-8");
    entries.push(JSON.parse(raw) as CorrectionEntry);
  }
  return entries;
}

function loadRawText(documentId: string): string {
  const fixtureFile = DOCUMENT_FIXTURES[documentId];
  if (!fixtureFile) throw new Error(`No fixture mapping for documentId: ${documentId}`);
  return fs.readFileSync(path.join(FIXTURE_TEXT_DIR, fixtureFile), "utf-8");
}

function isCompleteSentence(text: string): boolean {
  return /[.!?]$/.test(text.trim()) && text.trim().length >= 10;
}

function isGrammatical(text: string): boolean {
  // Reject answers that start mid-word or with connector fragments
  const trimmed = text.trim();
  if (/^[a-z]/.test(trimmed)) return false;
  if (/^(and|or|but|also|additionally|furthermore|moreover|however|therefore|thus|then|hence|so|>>|»)\b/i.test(trimmed)) return false;
  if (/^project activity\s*:/i.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length < 3) return false;
  return true;
}

function isTraceableToEvidence(answer: string, correction: CorrectionEntry): boolean {
  const answerLower = answer.toLowerCase();
  const expectedLower = correction.correctedAnswer.toLowerCase();
  // Extract substantive terms from the corrected answer (skip articles/prepositions)
  const keyTerms = expectedLower
    .replace(/[.,;:!?()"“”']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["the", "this", "that", "with", "from", "does", "what", "says", "about", "project", "document", "host", "country", "uses", "people's"].includes(w));
  if (keyTerms.length === 0) return true;
  const missingTerms = keyTerms.filter((term) => !answerLower.includes(term));
  return missingTerms.length <= Math.ceil(keyTerms.length * 0.5);
}

describe("Quick Check correction ingestion", () => {
  const corrections = loadCorrections();

  if (corrections.length === 0) {
    it.skip("no correction fixtures found", () => {});
    return;
  }

  test.each(corrections)("$checkId on $documentId produces a complete, grammatical, traceable answer", (correction) => {
    const checkQuestion = CHECK_QUESTIONS[correction.checkId];
    expect(checkQuestion).toBeDefined();

    const rawText = loadRawText(correction.documentId);
    const result = buildReviewQuestionResult({
      claimText: checkQuestion.question,
      methodologyId: correction.methodologyId,
      methodologyVersion: "02",
      rawPddText: rawText,
    });

    // Run through the same UI formatting pipeline
    const formatted = formatEvidenceCheckUiText({
      label: correction.checkId === "host_country" ? "Host country"
        : correction.checkId === "methodology" ? "Methodology"
        : correction.checkId === "baseline_scenario" ? "Baseline scenario"
        : correction.checkId === "additionality" ? "Additionality"
        : correction.checkId === "leakage" ? "Leakage"
        : correction.checkId === "stakeholder_consultation" ? "Stakeholder consultation"
        : correction.checkId,
      status: result.routerResult.status === "answered" ? "found"
        : result.routerResult.status === "unclear" ? "unclear"
        : result.routerResult.status === "no_evidence" ? "missing"
        : "unclear",
      answerText: result.routerResult.answerText || "",
      downgradeReason: result.routerResult.warnings.join("; "),
    });

    const answer = formatted.answerText.trim();

    // Assert completeness: answer is a full sentence ending with punctuation
    expect(isCompleteSentence(answer)).toBe(true);

    // Assert grammaticality: answer doesn't start mid-word or with connectors
    expect(isGrammatical(answer)).toBe(true);

    // Assert traceability: answer contains key terms from the expected answer
    expect(isTraceableToEvidence(answer, correction)).toBe(true);
  });
});

describe("Quick Check answer synthesis — host_country", () => {
  it("produces 'The host country is X.' format", () => {
    const rawText = loadRawText("taisei-china-pdd");
    const result = buildReviewQuestionResult({
      claimText: "What is the host country?",
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: rawText,
    });

    expect(result.routerResult.status).toBe("answered");

    const formatted = formatEvidenceCheckUiText({
      label: "Host country",
      status: "found",
      answerText: result.routerResult.answerText || "",
      downgradeReason: "",
    });

    expect(formatted.answerText.trim()).toMatch(/^The host country is /);
    expect(formatted.answerText.trim()).toMatch(/\.$/);
    expect(formatted.answerText.toLowerCase()).toContain("republic of china");
  });
});

describe("Quick Check answer synthesis — methodology", () => {
  it("produces 'The project uses CODE: description.' format", () => {
    const rawText = loadRawText("taisei-china-pdd");
    const result = buildReviewQuestionResult({
      claimText: "What methodology was applied?",
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: rawText,
    });

    expect(result.routerResult.status).toBe("answered");

    const formatted = formatEvidenceCheckUiText({
      label: "Methodology",
      status: "found",
      answerText: result.routerResult.answerText || "",
      downgradeReason: "",
    });

    // Methodology answers start with complete sentence
    expect(formatted.answerText.trim()).toMatch(/^The project uses /);
    expect(formatted.answerText.toLowerCase()).toContain("acm0010");
  });
});

describe("Quick Check answer synthesis — narrative checks", () => {
  const narrativeChecks: Array<{ checkId: string; question: string; expectedContains: string }> = [
    { checkId: "baseline_scenario", question: "What is the baseline scenario?", expectedContains: "baseline" },
    { checkId: "additionality", question: "What does the document say about additionality?", expectedContains: "additional" },
    { checkId: "leakage", question: "What does the document say about leakage?", expectedContains: "leakage" },
  ];

  test.each(narrativeChecks)("$checkId produces a complete sentence answer", ({ checkId, question, expectedContains }) => {
    const rawText = loadRawText("taisei-china-pdd");
    const result = buildReviewQuestionResult({
      claimText: question,
      methodologyId: "ACM0010",
      methodologyVersion: "02",
      rawPddText: rawText,
    });

    if (result.routerResult.status !== "answered") {
      // Skip assertion for unclear/no_evidence — these are document limitations, not formatting bugs
      return;
    }

    const formatted = formatEvidenceCheckUiText({
      label: checkId === "baseline_scenario" ? "Baseline scenario"
        : checkId === "additionality" ? "Additionality"
        : "Leakage",
      status: "found",
      answerText: result.routerResult.answerText || "",
      downgradeReason: "",
    });

    const answer = formatted.answerText.trim();
    // Narrative answers must end with proper punctuation
    expect(/[.!?]$/.test(answer)).toBe(true);
    // Must contain topic-relevant terms
    expect(answer.toLowerCase()).toContain(expectedContains);
    // Must not start mid-word or be a bare fragment
    expect(/^[A-Z]/.test(answer)).toBe(true);
    expect(answer.split(/\s+/).length).toBeGreaterThanOrEqual(5);
  });
});
