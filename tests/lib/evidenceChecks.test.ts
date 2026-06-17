import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import {
  formatEvidenceCheckUiText,
  getAllChecks,
  getContract,
  validateCheck,
} from "@/lib/quickCheck/evidenceChecks";
import { buildReviewQuestionResult, getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { EvidenceCheckId } from "@/lib/quickCheck/evidenceChecks";

const FIXTURE_DIR = path.join(process.cwd(), "tests/fixtures/quick-check");
const PLUM_A_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "a-pdf-extracted.txt"), "utf-8");
const PD_REDD_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "pd-redd-v130-extracted.txt"), "utf-8");
const RIMBA_RAYA_DOC_TEXT = fs.readFileSync(path.join(FIXTURE_DIR, "rimba-raya-fallback.txt"), "utf-8");

function runCheck(input: {
  checkId: EvidenceCheckId;
  claimText: string;
  rawText: string;
  methodologyId?: string;
  methodologyVersion?: string;
}) {
  const structuredQueryContext = getStructuredQueryContext(input.rawText);
  const questionResult = buildReviewQuestionResult({
    claimText: input.claimText,
    methodologyId: input.methodologyId ?? "",
    methodologyVersion: input.methodologyVersion ?? "",
    rawPddText: input.rawText,
    structuredQueryContext,
  });

  const validated = validateCheck(getContract(input.checkId), {
    evidenceDocument: structuredQueryContext.evidenceDocument,
    projectFactContract: structuredQueryContext.projectFactContract,
    sectionTableIndex: structuredQueryContext.sectionTableIndex,
    routerResult: questionResult.routerResult,
    queryIntentAnalysis: questionResult.queryIntentAnalysis,
  });

  return formatEvidenceCheckUiText({
    label: getAllChecks().find((check) => check.id === input.checkId)?.label ?? input.checkId,
    status: validated.status,
    answerText: validated.answerText,
    downgradeReason: validated.downgradeReason,
  });
}

describe("getAllChecks", () => {
  it("only exposes the six supported quick check topics", () => {
    expect(getAllChecks().map((check) => check.id)).toEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
  });
});

describe("formatEvidenceCheckUiText", () => {
  it("uses a human-readable missing message", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Crediting period",
        status: "missing",
        answerText: "",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Quick Check did not find a clear crediting period in the uploaded document.",
      downgradeReason: "",
    });
  });

  it("humanizes unclear validation reasons", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Host country",
        status: "unclear",
        answerText: "VCS Standard Version 4.0",
        downgradeReason: "Contains standard/methodology text, not a country name",
      }),
    ).toEqual({
      answerText: "VCS Standard Version 4.0",
      downgradeReason: "Quick Check found a possible mention, but it did not read like a specific country value.",
    });
  });

  it("keeps found answers unchanged", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Methodology",
        status: "found",
        answerText: "VM0007 v1.3",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "VM0007 v1.3",
      downgradeReason: "",
    });
  });

  it("parses methodology into a clean value", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Methodology",
        status: "found",
        answerText: "Title and reference of methodology applied: VM0007 REDD+ Methodology Framework version 1.6.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "VM0007 REDD+ Methodology Framework v1.6",
      downgradeReason: "",
    });
  });

  it("parses host country into a clean value", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Host country",
        status: "found",
        answerText: "Country/Area: Indonesia Project proponent: PT Rimba Makmur Utama",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Indonesia",
      downgradeReason: "",
    });
  });

  it("removes baseline heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Baseline scenario",
        status: "found",
        answerText: "2.4 Baseline Scenario The baseline scenario is continued cattle grazing on degraded grassland. Additional baseline details follow.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "The baseline scenario is continued cattle grazing on degraded grassland.",
      downgradeReason: "",
    });
  });

  it("removes additionality heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Additionality",
        status: "found",
        answerText: "2.5 Additionality Additionality is demonstrated through barrier analysis and limited access to finance. More text follows.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Additionality is demonstrated through barrier analysis and limited access to finance.",
      downgradeReason: "",
    });
  });

  it("removes leakage heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Leakage",
        status: "found",
        answerText: "1.10 Leakage Leakage from activity shifting is assessed and mitigated in this section. More text follows.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Leakage from activity shifting is assessed and mitigated in this section.",
      downgradeReason: "",
    });
  });

  it("removes stakeholder heading echoes and keeps the first substantive sentence", () => {
    expect(
      formatEvidenceCheckUiText({
        label: "Stakeholder consultation",
        status: "found",
        answerText: "6 Stakeholder consultation and participation Stakeholder consultation and participation were conducted through community meetings and workshops. Additional details follow.",
        downgradeReason: "",
      }),
    ).toEqual({
      answerText: "Stakeholder consultation and participation were conducted through community meetings and workshops.",
      downgradeReason: "",
    });
  });
});

describe("authoritative evidence check selectors", () => {
  it("prefers primary methodology evidence from the document", () => {
    const result = runCheck({
      checkId: "methodology",
      claimText: "What methodology was applied?",
      rawText: RIMBA_RAYA_DOC_TEXT,
    });

    expect(result.answerText).toContain("VM0004");
    expect(result.answerText).not.toMatch(/^Project Description/i);
  });

  it("prefers the baseline section body instead of a heading-only match", () => {
    const result = runCheck({
      checkId: "baseline_scenario",
      claimText: "What is the baseline scenario?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).not.toMatch(/^2\.4 Baseline Scenario/i);
    expect(result.answerText.toLowerCase()).toContain("traditional agricultural practices");
  });

  it("prefers the additionality section body instead of TOC or methodology references", () => {
    const result = runCheck({
      checkId: "additionality",
      claimText: "What does the document say about additionality?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).not.toMatch(/^2\.5 Additionality/i);
    expect(result.answerText.toLowerCase()).toContain("as per vt0001");
  });

  it("prefers the main leakage section body over appendix and monitoring references", () => {
    const result = runCheck({
      checkId: "leakage",
      claimText: "What does the document say about leakage?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText).toContain("Leakage emissions accounted for are entirely from displacement of unplanned deforestation");
    expect(result.answerText).not.toContain("Appendix I");
  });

  it("prefers substantive stakeholder consultation text over the section heading", () => {
    const result = runCheck({
      checkId: "stakeholder_consultation",
      claimText: "What does the document say about stakeholder consultation?",
      rawText: PD_REDD_DOC_TEXT,
    });

    expect(result.answerText.toLowerCase()).toContain("participatory process");
    expect(result.answerText).not.toMatch(/^6 Stakeholder Comments/i);
  });

  it("uses early structured location-country evidence for PLUM instead of drifting into body noise", () => {
    const result = runCheck({
      checkId: "host_country",
      claimText: "What is the host country?",
      rawText: PLUM_A_DOC_TEXT,
    });

    expect(result.answerText).toBe("Indonesia");
  });
});
