import { describe, expect, it } from "@jest/globals";
import { formatEvidenceCheckUiText } from "@/lib/quickCheck/evidenceChecks";

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
});
