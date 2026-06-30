import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  type RetrievedEvidence,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult, validateAnswerResults, type StatusResult } from "@/lib/quickCheckV2/status";

const ISS_FIXTURE_PATH =
  "tests/fixtures/quick-check/iss-rep-1530-extracted.txt";
const GOLD_FIXTURE_PATH =
  "tests/fixtures/quick-check/iss-rep-gold-fixture.json";

type GoldRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string | null;
  page: number;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback";
  reason: string | null;
};

/**
 * A full snapshot of pipeline output for one check, including the answer.
 * This is used for gold comparison — unlike GoldComparableRecord (which
 * strips expectedAnswer), this keeps answer so that answer regressions
 * in extractAnswersForAllChecks() are caught.
 */
type PipelineSnapshot = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  answer: string | null;
  goldQuote: string | null;
  page: number;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback";
  reason: string | null;
};

function loadGoldFixture(): GoldRecord[] {
  return JSON.parse(
    fs.readFileSync(path.resolve(GOLD_FIXTURE_PATH), "utf-8"),
  ) as GoldRecord[];
}

/** Build a PipelineSnapshot from a StatusResult, preserving the answer. */
function toPipelineSnapshot(
  result: StatusResult,
): PipelineSnapshot {
  return {
    checkName: result.checkName,
    expectedStatus: result.status,
    answer: result.answer,
    goldQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? 0,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? "",
    sourceType: result.evidence?.sourceType ?? "fact_contract",
    reason: result.reason ?? null,
  };
}

/** Convert a GoldRecord to a PipelineSnapshot for comparison, mapping expectedAnswer → answer. */
function goldRecordToSnapshot(record: GoldRecord): PipelineSnapshot {
  return {
    checkName: record.checkName,
    expectedStatus: record.expectedStatus,
    answer: record.expectedAnswer,
    goldQuote: record.goldQuote,
    page: record.page,
    sectionHeading: record.sectionHeading,
    sectionPath: record.sectionPath,
    spanId: record.spanId,
    sourceType: record.sourceType,
    reason: record.reason,
  };
}

describe("Quick Check v2 — ISS issuance deed gold fixture", () => {
  const goldFixture = loadGoldFixture();
  const document = loadAndParseExtractedText(ISS_FIXTURE_PATH);
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("matches the ISS gold fixture across the v2 retrieval, answer extraction, and status pipeline", () => {
    // This is the primary enforcement test.
    // It compares status + evidence + answer against gold, so a regression
    // in any layer (evidence retrieval, answer extraction, status validation)
    // is caught. This was the gap in the original fixture — expectedAnswer
    // was stripped from the comparison.
    expect(statuses.map(toPipelineSnapshot)).toStrictEqual(
      goldFixture.map(goldRecordToSnapshot),
    );
  });

  it("all six ISS checks have correct expected answers in gold fixture", () => {
    expect(goldFixture.map((record) => ({
      checkName: record.checkName,
      expectedAnswer: record.expectedAnswer,
    }))).toStrictEqual([
      { checkName: "host_country", expectedAnswer: null },
      { checkName: "methodology", expectedAnswer: null },
      { checkName: "baseline_scenario", expectedAnswer: null },
      { checkName: "additionality", expectedAnswer: "if the second Verification Report shows a VCU has been erroneously issued Verra will have an additional 12" },
      { checkName: "leakage", expectedAnswer: null },
      { checkName: "stakeholder_consultation", expectedAnswer: null },
    ]);
  });

  it("additionality returns UNCLEAR (not FOUND) for the legal 'additional' boilerplate", () => {
    // The word "additional" appears in legal boilerplate: "an additional
    // 12 months" — NOT as a project additionality claim. The raw-text
    // fallback picks it up but the status validator correctly downgrades
    // it to UNCLEAR because it's fallback evidence only.
    const additionality: StatusResult | undefined = statuses.find(
      (result: StatusResult) => result.checkName === "additionality",
    );
    expect(additionality?.status).toBe("UNCLEAR");
    expect(additionality?.reason).toBe("fallback_evidence_only");
    expect(additionality?.evidence?.sourceType).toBe("raw_text_fallback");
    // The answer must match gold exactly — not change on regressions
    expect(additionality?.answer).toBe(
      "if the second Verification Report shows a VCU has been erroneously issued Verra will have an additional 12",
    );
  });

  it("five of six checks correctly return MISSING for this non-PDD document", () => {
    const missingChecks: StatusResult[] = statuses.filter((s: StatusResult) => s.status === "MISSING");
    expect(missingChecks).toHaveLength(5);
  });

  it("no check returns FOUND for a legal document with no PDD content", () => {
    const foundChecks: StatusResult[] = statuses.filter((s: StatusResult) => s.status === "FOUND");
    expect(foundChecks).toHaveLength(0);
  });

  it("host_country returns MISSING — no project location in a legal deed", () => {
    const host: StatusResult | undefined = statuses.find((s: StatusResult) => s.checkName === "host_country");
    expect(host?.status).toBe("MISSING");
    expect(host?.reason).toBe("evidence_missing");
    expect(host?.answer).toBeNull();
  });

  it("methodology returns MISSING — no methodology named in the deed", () => {
    const meth: StatusResult | undefined = statuses.find((s: StatusResult) => s.checkName === "methodology");
    expect(meth?.status).toBe("MISSING");
    expect(meth?.reason).toBe("evidence_missing");
    expect(meth?.answer).toBeNull();
  });

  it("baseline_scenario returns MISSING — no baseline determination in legal confirmation", () => {
    const base: StatusResult | undefined = statuses.find((s: StatusResult) => s.checkName === "baseline_scenario");
    expect(base?.status).toBe("MISSING");
    expect(base?.reason).toBe("evidence_missing");
    expect(base?.answer).toBeNull();
  });

  it("leakage returns MISSING — no leakage section in the deed", () => {
    const leak: StatusResult | undefined = statuses.find((s: StatusResult) => s.checkName === "leakage");
    expect(leak?.status).toBe("MISSING");
    expect(leak?.reason).toBe("evidence_missing");
    expect(leak?.answer).toBeNull();
  });

  it("stakeholder_consultation returns MISSING — no stakeholder section in the deed", () => {
    const stak: StatusResult | undefined = statuses.find((s: StatusResult) => s.checkName === "stakeholder_consultation");
    expect(stak?.status).toBe("MISSING");
    expect(stak?.reason).toBe("evidence_missing");
    expect(stak?.answer).toBeNull();
  });

  it("returns UNCLEAR when answer provenance is incomplete", () => {
    const result = validateAnswerResult({
      checkName: "additionality",
      answer: "Additionality is demonstrated.",
      evidence: {
        sourceType: "exact_section",
        quote: "Additionality is demonstrated.",
        page: 0,
        sectionHeading: null,
        sectionPath: [],
        spanId: "",
      } as RetrievedEvidence,
    });

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns MISSING when evidence is null", () => {
    const result = validateAnswerResult({
      checkName: "additionality",
      answer: null,
      evidence: null,
    });

    expect(result.status).toBe("MISSING");
    expect(result.reason).toBe("evidence_missing");
  });
});
