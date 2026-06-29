import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks, type AnswerResult } from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  type RetrievedEvidence,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult, validateAnswerResults } from "@/lib/quickCheckV2/status";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";
const GOLD_FIXTURE_PATH =
  "tests/fixtures/quick-check/envira-gold-fixture.json";

type GoldRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string;
  page: number;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback";
};

type GoldComparableRecord = Omit<GoldRecord, "expectedAnswer">;

function loadGoldFixture(): GoldRecord[] {
  return JSON.parse(
    fs.readFileSync(path.resolve(GOLD_FIXTURE_PATH), "utf-8"),
  ) as GoldRecord[];
}

function toGoldComparableRecord(
  result: ReturnType<typeof validateAnswerResult>,
): GoldComparableRecord {
  if (!result.evidence) {
    throw new Error(`Expected evidence for ${result.checkName}`);
  }

  return {
    checkName: result.checkName,
    expectedStatus: result.status,
    goldQuote: result.evidence.quote,
    page: result.evidence.page,
    sectionHeading: result.evidence.sectionHeading,
    sectionPath: result.evidence.sectionPath,
    spanId: result.evidence.spanId,
    sourceType: result.evidence.sourceType,
  };
}

function makeAnswerResult(
  overrides: Partial<AnswerResult>,
): AnswerResult {
  return {
    checkName: "additionality",
    answer: "Additionality is demonstrated.",
    evidence: {
      sourceType: "exact_section",
      quote: "Additionality is demonstrated.",
      page: 38,
      sectionHeading: "Additionality",
      sectionPath: ["2", "2.5"],
      spanId: "synthetic-doc:p38:b0:add",
    },
    ...overrides,
  };
}

describe("Quick Check v2 — Phase 6 gold Envira fixture", () => {
  const goldFixture = loadGoldFixture();
  const document = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("matches the Envira gold fixture across the v2 retrieval and status pipeline", () => {
    expect(statuses.map(toGoldComparableRecord)).toStrictEqual(
      goldFixture.map(({ expectedAnswer: _expectedAnswer, ...record }) => record),
    );
  });

  it("keeps curated human-readable expected answers for the six structured checks", () => {
    expect(goldFixture.map((record) => ({
      checkName: record.checkName,
      expectedAnswer: record.expectedAnswer,
    }))).toStrictEqual([
      { checkName: "host_country", expectedAnswer: "Brazil" },
      { checkName: "methodology", expectedAnswer: "VM0007: REDD Methodology Modules (REDD-MF)" },
      { checkName: "baseline_scenario", expectedAnswer: "Conversion of the non-legal reserve to pasture after logging and clear-cutting to establish a cattle ranch." },
      { checkName: "additionality", expectedAnswer: "The project depends on VCS carbon-credit income because conservation produces no other financial or economic benefits." },
      { checkName: "leakage", expectedAnswer: "Leakage is assessed under VM0007 using LK-ASP and LK-ME for activity-shifting and market-effects leakage." },
      { checkName: "stakeholder_consultation", expectedAnswer: "Local families, project proponents, consultants, Acre state actors, and other stakeholders were involved in project design." },
    ]);
  });

  it("rejects junk answers like a lone 'of' from the accepted Envira results", () => {
    expect(statuses.some((result) => result.answer === "of")).toBe(false);
  });

  it("rejects boilerplate-only quotes for baseline and additionality", () => {
    const boilerplatePattern = /tool for the demonstration and assessment of additionality/i;
    const targetedChecks = new Set<StructuredCheckId>([
      "baseline_scenario",
      "additionality",
    ]);

    for (const result of statuses) {
      if (!targetedChecks.has(result.checkName) || !result.evidence) continue;
      expect(boilerplatePattern.test(result.evidence.quote)).toBe(false);
    }
  });

  it("fails the fixture if the accepted evidence points at the wrong section", () => {
    const baseline = statuses.find((result) => result.checkName === "baseline_scenario");
    expect(baseline?.evidence?.sectionHeading).toBe("Conversion to Pasture");
    expect(baseline?.evidence?.sectionPath).toStrictEqual(["2", "2.4", "2.4.2"]);
  });

  it("returns UNCLEAR when answer provenance is incomplete", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: {
          sourceType: "exact_section",
          quote: "Additionality is demonstrated.",
          page: 0,
          sectionHeading: null,
          sectionPath: [],
          spanId: "",
        } as RetrievedEvidence,
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns MISSING when evidence is null", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        answer: null,
        evidence: null,
      }),
    );

    expect(result.status).toBe("MISSING");
    expect(result.reason).toBe("evidence_missing");
  });

  it("does not allow raw-text fallback evidence to become FOUND", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: {
          sourceType: "raw_text_fallback",
          quote: "Additionality is demonstrated.",
          page: 38,
          sectionHeading: "Additionality",
          sectionPath: ["2", "2.5"],
          spanId: "synthetic-doc:p38:b0:add",
        },
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("fallback_evidence_only");
  });
});
