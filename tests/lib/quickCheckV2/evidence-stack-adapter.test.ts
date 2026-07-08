import { describe, expect, it } from "@jest/globals";
import { extractAnswerFromEvidence } from "@/lib/quickCheckV2/answers";
import {
  buildQuickCheckEvidenceStackDisplay,
  normalizeQuickCheckEvidenceCarrier,
} from "@/lib/quickCheckV2/evidenceStackAdapter";
import { buildComparableQuickCheckRecord } from "./goldComparison";

describe("Quick Check v2 evidence stack adapter", () => {
  const evidence = {
    sourceType: "exact_section" as const,
    quote: "Primary quote from the project description.",
    page: 17,
    sectionHeading: "Additionality",
    sectionPath: ["3", "3.2"],
    spanId: "synthetic-doc:p17:b1",
  };

  it("normalizes legacy single evidence into a primary evidence stack", () => {
    const result = extractAnswerFromEvidence({
      checkName: "additionality",
      evidence,
    });

    expect(result.evidence).toStrictEqual(evidence);
    expect(result.evidenceStack).toStrictEqual([
      {
        role: "primary",
        page: 17,
        quote: "Primary quote from the project description.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
        label: undefined,
        reason: undefined,
      },
    ]);
  });

  it("keeps existing result.evidence usable for legacy consumers", () => {
    const normalized = normalizeQuickCheckEvidenceCarrier({
      evidence,
      evidenceStack: [
        {
          role: "primary",
          page: 17,
          quote: "Primary quote from the project description.",
          sectionHeading: "Additionality",
          sectionPath: ["3", "3.2"],
          spanId: "synthetic-doc:p17:b1",
          sourceType: "exact_section",
        },
        {
          role: "caveat",
          page: 18,
          quote: "Formal VCS section is still incomplete.",
          sectionHeading: "Additionality caveat",
          sectionPath: ["3", "3.3"],
          spanId: "synthetic-doc:p18:b1",
          sourceType: "exact_section",
        },
      ],
    });

    expect(normalized.evidence).toStrictEqual(evidence);
    expect(normalized.evidenceStack).toHaveLength(2);
  });

  it("formats primary first and keeps caveat/blocker labels with page numbers", () => {
    const display = buildQuickCheckEvidenceStackDisplay([
      {
        role: "blocker",
        page: 22,
        quote: "A blocker quote.",
      },
      {
        role: "primary",
        page: 17,
        quote: "Primary quote from the project description.",
        sectionHeading: "Additionality",
      },
      {
        role: "caveat",
        page: 19,
        quote: "A caveat quote.",
        sectionHeading: "Additionality caveat",
      },
    ]);

    expect(display.map((item) => item.roleLabel)).toStrictEqual([
      "Primary",
      "Caveat",
      "Blocker",
    ]);
    expect(display.map((item) => item.page)).toStrictEqual([17, 19, 22]);
  });

  it("compares legacy gold exactly when expected evidenceStack is absent", () => {
    const comparable = buildComparableQuickCheckRecord(
      {
        checkName: "additionality",
        status: "FOUND",
        answer: "Additionality is demonstrated.",
        evidence,
        evidenceStack: [
          {
            role: "primary",
            page: 17,
            quote: "Primary quote from the project description.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p17:b1",
            sourceType: "exact_section",
          },
          {
            role: "supporting",
            page: 18,
            quote: "Supporting quote.",
            sectionHeading: "Additionality support",
            sectionPath: ["3", "3.2.1"],
            spanId: "synthetic-doc:p18:b1",
            sourceType: "exact_section",
          },
        ],
        reason: "answer_and_provenance_complete",
      },
      {
        checkName: "additionality",
        expectedStatus: "FOUND",
        expectedAnswer: "Additionality is demonstrated.",
        goldQuote: "Primary quote from the project description.",
        page: 17,
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
      },
    );

    expect("evidenceStack" in comparable).toBe(false);
  });

  it("includes evidenceStack comparison only when expected gold asks for it", () => {
    const comparable = buildComparableQuickCheckRecord(
      {
        checkName: "additionality",
        status: "UNCLEAR",
        answer: "Additionality evidence exists but remains qualified.",
        evidence,
        evidenceStack: [
          {
            role: "primary",
            page: 17,
            quote: "Primary quote from the project description.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p17:b1",
            sourceType: "exact_section",
          },
          {
            role: "caveat",
            page: 18,
            quote: "Formal VCS section is still incomplete.",
            sectionHeading: "Additionality caveat",
            sectionPath: ["3", "3.3"],
            spanId: "synthetic-doc:p18:b1",
            sourceType: "exact_section",
            label: "Formal section gap",
            reason: "Not required at this stage",
          },
        ],
        reason: "provenance_incomplete",
      },
      {
        checkName: "additionality",
        expectedStatus: "UNCLEAR",
        expectedAnswer: "Additionality evidence exists but remains qualified.",
        goldQuote: "Primary quote from the project description.",
        page: 17,
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
        evidenceStack: [
          {
            role: "primary",
            page: 17,
            quote: "Primary quote from the project description.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p17:b1",
            sourceType: "exact_section",
          },
          {
            role: "caveat",
            page: 18,
            quote: "Formal VCS section is still incomplete.",
            sectionHeading: "Additionality caveat",
            sectionPath: ["3", "3.3"],
            spanId: "synthetic-doc:p18:b1",
            sourceType: "exact_section",
            label: "Formal section gap",
            reason: "Not required at this stage",
          },
        ],
      },
    );

    expect(comparable.evidenceStack).toStrictEqual([
      {
        role: "primary",
        page: 17,
        quote: "Primary quote from the project description.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
        label: undefined,
        reason: undefined,
      },
      {
        role: "caveat",
        page: 18,
        quote: "Formal VCS section is still incomplete.",
        sectionHeading: "Additionality caveat",
        sectionPath: ["3", "3.3"],
        spanId: "synthetic-doc:p18:b1",
        sourceType: "exact_section",
        label: "Formal section gap",
        reason: "Not required at this stage",
      },
    ]);
  });

  it("keeps opt-in evidenceStack comparison strict when roles, pages, quotes, or blockers do not match", () => {
    const comparable = buildComparableQuickCheckRecord(
      {
        checkName: "additionality",
        status: "UNCLEAR",
        answer: "Additionality evidence exists but remains qualified.",
        evidence,
        evidenceStack: [
          {
            role: "primary",
            page: 17,
            quote: "Primary quote from the project description.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p17:b1",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 18,
            quote: "Formal VCS section is still incomplete.",
            sectionHeading: "Additionality caveat",
            sectionPath: ["3", "3.3"],
            spanId: "synthetic-doc:p18:b1",
            sourceType: "exact_section",
          },
        ],
        reason: "provenance_incomplete",
      },
      {
        checkName: "additionality",
        expectedStatus: "UNCLEAR",
        expectedAnswer: "Additionality evidence exists but remains qualified.",
        goldQuote: "Primary quote from the project description.",
        page: 17,
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
        evidenceStack: [
          {
            role: "primary",
            page: 17,
            quote: "Primary quote from the project description.",
            sectionHeading: "Additionality",
            sectionPath: ["3", "3.2"],
            spanId: "synthetic-doc:p17:b1",
            sourceType: "exact_section",
          },
          {
            role: "blocker",
            page: 19,
            quote: "Formal VCS section is still incomplete.",
            sectionHeading: "Additionality caveat",
            sectionPath: ["3", "3.3"],
            spanId: "synthetic-doc:p19:b1",
            sourceType: "exact_section",
          },
        ],
      },
    );

    expect(comparable.evidenceStack).not.toStrictEqual([
      {
        role: "primary",
        page: 17,
        quote: "Primary quote from the project description.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
        label: undefined,
        reason: undefined,
      },
      {
        role: "blocker",
        page: 19,
        quote: "Formal VCS section is still incomplete.",
        sectionHeading: "Additionality caveat",
        sectionPath: ["3", "3.3"],
        spanId: "synthetic-doc:p19:b1",
        sourceType: "exact_section",
      },
    ]);
  });
});
