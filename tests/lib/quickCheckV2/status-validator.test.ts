import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks, type AnswerResult } from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  type RetrievedEvidence,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult, validateAnswerResults } from "@/lib/quickCheckV2/status";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/envira/extracted.txt";
const ENVIRA_DOCUMENT_ID = "proj-desc-1382-extracted";

const STATUS_SOURCE_PATH = path.resolve("src/lib/quickCheckV2/status/index.ts");

function makeAnswerResult(
  overrides: Partial<AnswerResult>,
): AnswerResult {
  const result: AnswerResult = {
    checkName: "additionality",
    answer: "Additionality is demonstrated.",
    evidence: {
      sourceType: "exact_section",
      quote: "Additionality is demonstrated.",
      page: 38,
      sectionHeading: "Additionality",
      sectionPath: ["3", "3.2"],
      spanId: "synthetic-doc:p38:b0:add",
    },
    evidenceStack: [
      {
        role: "primary",
        page: 38,
        quote: "Additionality is demonstrated.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p38:b0:add",
        sourceType: "exact_section",
      },
    ],
    ...overrides,
  };

  if (result.evidence === null && overrides.evidenceStack === undefined) {
    result.evidenceStack = [];
  }

  return result;
}

describe("Quick Check v2 — Phase 5 deterministic status validator", () => {
  const document = loadAndParseExtractedText(
    ENVIRA_FIXTURE_PATH,
    ENVIRA_DOCUMENT_ID,
  );
  const answers = extractAnswersForAllChecks(document);
  const statuses = validateAnswerResults(answers);

  it("marks all six Envira structured checks as FOUND", () => {
    expect(statuses).toHaveLength(6);
    expect(statuses.every((result) => result.status === "FOUND")).toBe(true);
  });

  it("returns MISSING when evidence is null", () => {
    expect(
      validateAnswerResult(
        makeAnswerResult({
          answer: null,
          evidence: null,
        }),
      ),
    ).toStrictEqual({
      checkName: "additionality",
      status: "MISSING",
      answer: null,
      evidence: null,
      reason: "evidence_missing",
    });
  });

  it("returns UNCLEAR when evidence exists but answer is null", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        answer: null,
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("answer_missing");
  });

  it("returns UNCLEAR when answer exists without complete provenance", () => {
    const incompleteEvidence = {
      sourceType: "exact_section",
      quote: "Additionality is demonstrated.",
      page: 0,
      sectionHeading: null,
      sectionPath: [],
      spanId: "",
    } as RetrievedEvidence;

    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: incompleteEvidence,
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns UNCLEAR when only raw-text fallback evidence supports the answer", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        evidence: {
          sourceType: "raw_text_fallback",
          quote: "Additionality is demonstrated.",
          page: 38,
          sectionHeading: "Additionality",
          sectionPath: ["3", "3.2"],
          spanId: "synthetic-doc:p38:b0:add",
        },
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("fallback_evidence_only");
  });

  it("returns FOUND for fact-contract evidence with complete answer and provenance", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "methodology",
        answer: "VM0007",
        evidence: {
          sourceType: "fact_contract",
          quote: "The project applies methodology VM0007.",
          page: 31,
          sectionHeading: "Title and Reference of Methodology",
          sectionPath: ["3", "3.1"],
          spanId: "synthetic-doc:p31:b0:methodology",
        },
      }),
    );

    expect(result.status).toBe("FOUND");
    expect(result.reason).toBe("answer_and_provenance_complete");
  });

  it("returns FOUND for exact-section evidence with complete answer and provenance", () => {
    const result = validateAnswerResult(makeAnswerResult({}));

    expect(result.status).toBe("FOUND");
    expect(result.reason).toBe("answer_and_provenance_complete");
    expect(result.evidenceStack?.[0]?.role).toBe("primary");
  });

  it("returns UNCLEAR when the evidence stack has no primary citation", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        evidenceStack: [
          {
            role: "supporting",
            page: 38,
            quote: "Supporting evidence only.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p38:b0:add",
            sourceType: "exact_section",
          },
        ],
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns UNCLEAR for baseline evidence when a blocker stack item marks the formal section incomplete", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "baseline_scenario",
        answer: "The baseline is defined as continuation of grazing without the project.",
        evidence: {
          sourceType: "exact_section",
          quote: "The baseline is defined as continuation of grazing without the project.",
          page: 2,
          sectionHeading: "Most-Likely Scenario Justification",
          sectionPath: ["2", "2.4"],
          spanId: "synthetic-doc:p2:b1:baseline",
        },
        evidenceStack: [
          {
            role: "primary",
            page: 2,
            quote: "The baseline is defined as continuation of grazing without the project.",
            sectionHeading: "Most-Likely Scenario Justification",
            sectionPath: ["2", "2.4"],
            spanId: "synthetic-doc:p2:b1:baseline",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 4,
            quote: "This section is under development.",
            sectionHeading: "Baseline Scenario",
            sectionPath: ["3", "3.13"],
            spanId: "synthetic-doc:p4:b1:baseline",
            sourceType: "exact_section",
            label: "Formal baseline section incomplete",
          },
        ],
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("under_development_stub");
  });

  it("returns UNCLEAR for additionality when blocker evidence is present", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "additionality",
        evidence: {
          sourceType: "exact_section",
          quote: "The project clearly demonstrates additionality.",
          page: 7,
          sectionHeading: "Additionality Methods",
          sectionPath: ["3", "3.2"],
          spanId: "synthetic-doc:p7:b1:additionality",
        },
        evidenceStack: [
          {
            role: "primary",
            page: 7,
            quote: "The project clearly demonstrates additionality.",
            sectionHeading: "Additionality Methods",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p7:b1:additionality",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 9,
            quote: "The formal VCS section is not required at the Under Development stage.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.3"],
            spanId: "synthetic-doc:p9:b1:additionality",
            sourceType: "exact_section",
          },
        ],
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns UNCLEAR for leakage when blocker evidence is present", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "leakage",
        answer: "Leakage emissions are managed.",
        evidence: {
          sourceType: "exact_section",
          quote: "Leakage emissions are managed.",
          page: 11,
          sectionHeading: "Leakage Emissions",
          sectionPath: ["4", "4.3"],
          spanId: "synthetic-doc:p11:b1:leakage",
        },
        evidenceStack: [
          {
            role: "primary",
            page: 11,
            quote: "Leakage emissions are managed.",
            sectionHeading: "Leakage Emissions",
            sectionPath: ["4", "4.3"],
            spanId: "synthetic-doc:p11:b1:leakage",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 12,
            quote: "This section is not required at the Under Development stage.",
            sectionHeading: "Leakage Management",
            sectionPath: ["4", "4.4"],
            spanId: "synthetic-doc:p12:b1:leakage",
            sourceType: "exact_section",
          },
        ],
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("returns UNCLEAR for stakeholder consultation when blocker evidence is present", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "stakeholder_consultation",
        answer: "Stakeholder consultation is documented.",
        evidence: {
          sourceType: "exact_section",
          quote: "Stakeholder consultation is documented.",
          page: 13,
          sectionHeading: "Stakeholder Consultations",
          sectionPath: ["2", "2.3.10"],
          spanId: "synthetic-doc:p13:b1:stakeholder",
        },
        evidenceStack: [
          {
            role: "primary",
            page: 13,
            quote: "Stakeholder consultation is documented.",
            sectionHeading: "Stakeholder Consultations",
            sectionPath: ["2", "2.3.10"],
            spanId: "synthetic-doc:p13:b1:stakeholder",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 14,
            quote: "The formal consultation section is not required at the Under Development stage.",
            sectionHeading: "Stakeholder Consultations",
            sectionPath: ["2", "2.3.11"],
            spanId: "synthetic-doc:p14:b1:stakeholder",
            sourceType: "exact_section",
          },
        ],
      }),
    );

    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("provenance_incomplete");
  });

  it("includes a structured methodology identity on methodology rows", () => {
    const methodology = statuses.find((result) => result.checkName === "methodology");
    expect(methodology?.methodology?.methodologyId).toBe("VM0007");
    expect(methodology?.methodology?.evidencePage).toBe(31);
    expect(methodology?.methodology?.evidenceSection).toBeTruthy();
    expect(methodology?.methodology?.evidenceQuote).toContain("VM0007");
  });

  it("keeps an explicit version when the methodology quote declares one", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "methodology",
        answer: "VM0007: REDD Methodology Modules Version 1.3",
        evidence: {
          sourceType: "exact_section",
          quote: "The methodology used to quantify the avoided emissions is the framework and component modules of the modular REDD methodology VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012.",
          page: 15,
          sectionHeading: "Title and Reference of Methodology",
          sectionPath: ["2", "2.1"],
          spanId: "synthetic-doc:p15:b1:methodology",
        },
      }),
    );

    expect(result.methodology?.methodologyId).toBe("VM0007");
    expect(result.methodology?.pddDeclaredMethodologyVersion).toBe("v1.3");
    expect(result.methodology?.versionStatus).toBe("DECLARED");
  });

  it("does not invent a version when the quote does not explicitly declare one", () => {
    const result = validateAnswerResult(
      makeAnswerResult({
        checkName: "methodology",
        answer: "VM0007: REDD Methodology Modules (REDD-MF)",
        evidence: {
          sourceType: "fact_contract",
          quote: "The Envira Amazonia Project is utilizing the Avoided Deforestation Partners’ VCS REDD Methodology, entitled, “VM0007: REDD Methodology Modules (REDD-MF).”",
          page: 31,
          sectionHeading: "Title and Reference of Methodology",
          sectionPath: ["2", "2.1"],
          spanId: "synthetic-doc:p31:b0:methodology",
        },
      }),
    );

    expect(result.methodology?.methodologyId).toBe("VM0007");
    expect(result.methodology?.pddDeclaredMethodologyVersion).toBeNull();
    expect(result.methodology?.versionStatus).toBe("NOT_EXPLICITLY_DECLARED");
  });

  it("returns only checkName, status, answer, evidence, and reason", () => {
    for (const result of statuses) {
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(
        result.checkName === "methodology"
          ? ["answer", "checkName", "evidence", "evidenceStack", "methodology", "reason", "status"]
          : ["answer", "checkName", "evidence", "evidenceStack", "reason", "status"],
      );
      expect(Object.keys(result)).not.toContain("score");
      expect(Object.keys(result)).not.toContain("router");
    }
  });

  it("does not leak score or router fields into evidence", () => {
    for (const result of statuses) {
      if (!result.evidence) continue;
      expect(Object.keys(result.evidence)).not.toContain("score");
      expect(Object.keys(result.evidence)).not.toContain("router");
      expect(Object.keys(result.evidence)).not.toContain("status");
    }
  });

  it("does not import search, ranking, scoring, router, Blob, LLM, or Quick Check v1 code", () => {
    const source = fs.readFileSync(STATUS_SOURCE_PATH, "utf-8");

    expect(source).not.toMatch(/retrieveEvidenceFor(Check|AllChecks)/);
    expect(source).not.toMatch(/extractAnswerForCheck\s*\(/);
    expect(source).not.toMatch(/extractAnswersForAllChecks\s*\(/);
    expect(source).not.toMatch(/from\s+"@\/lib\/quickCheck\//);
    expect(source).not.toMatch(/from\s+"@\/lib\/chat\//);
    expect(source).not.toMatch(/from\s+"@\/lib\/quickCheckV2\/(ingestion|section-tree)"/);
  });
});
