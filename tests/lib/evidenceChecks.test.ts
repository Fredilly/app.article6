import { describe, expect, it } from "@jest/globals";
import { formatEvidenceCheckUiText, getAllChecks } from "@/lib/quickCheck/evidenceChecks";

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
