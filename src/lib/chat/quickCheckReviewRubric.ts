import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";

export type ReviewRubricArea = "baseline" | "right_of_use" | "stakeholder";
export type ReviewRubricVerdict = "supported" | "partial" | "missing";

export type ReviewRubricResult = {
  review_area: ReviewRubricArea;
  verdict: ReviewRubricVerdict;
  evidence_summary: string;
  cited_sections: string[];
  gaps: string[];
  recommended_follow_up_documents: string[];
  confidence: number;
};

type EvaluateReviewRubricInput = {
  reviewArea: ReviewRubricArea;
  matchedHeadings: DocumentHeading[];
};

type SignalGroup = {
  name: string;
  required: boolean;
  patterns: RegExp[];
  gapMessage: string;
};

type RubricConfig = {
  reviewAreaLabel: string;
  followUpMissing: string[];
  followUpDefault: string[];
  supportedThreshold: number;
  partialThreshold: number;
  strongSignalWeight: number;
  weakSignalWeight: number;
  requiredSignals: SignalGroup[];
  weakSignals: SignalGroup[];
};

const SECTIONLESS_REASON_BY_AREA: Record<ReviewRubricArea, { summary: string; gaps: string[]; followUp: string[] }> = {
  baseline: {
    summary: "No baseline-matched document section was recovered from the uploaded PDD heading index.",
    gaps: [
      "No uploaded PDD section heading matched the baseline review question.",
      "Quick Check could not verify a baseline scenario discussion from document-grounded sections.",
    ],
    followUp: [
      "PDD section or annex describing the baseline scenario / without-project case",
      "Historical land-use change analysis or baseline modelling note",
    ],
  },
  right_of_use: {
    summary: "No right-of-use or legal authority section was recovered from the uploaded PDD heading index.",
    gaps: [
      "No uploaded PDD section heading matched the right-of-use review question.",
      "Quick Check could not verify legal authority, ownership, or right-of-use evidence from document-grounded sections.",
    ],
    followUp: [
      "PDD section or annex describing ownership, right of use, or land/resource rights",
      "Permit, title, concession, lease, or community agreement proving authority to manage the project area",
    ],
  },
  stakeholder: {
    summary: "No stakeholder consultation section was recovered from the uploaded PDD heading index.",
    gaps: [
      "No uploaded PDD section heading matched the stakeholder review question.",
      "Quick Check could not verify stakeholder consultation or participation evidence from document-grounded sections.",
    ],
    followUp: [
      "PDD section or annex summarizing stakeholder consultation and participation",
      "Consultation records such as meeting minutes, attendance logs, comments, or grievance documentation",
    ],
  },
};

const BASELINE_CONFIG: RubricConfig = {
  reviewAreaLabel: "baseline",
  followUpMissing: SECTIONLESS_REASON_BY_AREA.baseline.followUp,
  followUpDefault: [
    "Historical land-use change analysis or baseline modelling note",
    "Remote sensing or inventory source used to justify baseline assumptions",
  ],
  supportedThreshold: 6,
  partialThreshold: 2,
  strongSignalWeight: 2,
  weakSignalWeight: 1,
  requiredSignals: [
    {
      name: "scenario",
      required: true,
      patterns: [
        /\bbaseline scenario\b/i,
        /\bwithout-project\b/i,
        /\bwithout project\b/i,
        /\babsence of the project\b/i,
        /\bmost likely land[- ]use scenario\b/i,
        /\bbusiness as usual\b/i,
      ],
      gapMessage: "No clear baseline or without-project scenario statement was found in the matched section text.",
    },
    {
      name: "evidence_basis",
      required: true,
      patterns: [
        /\bhistorical\b/i,
        /\bsatellite\b/i,
        /\bremote sensing\b/i,
        /\bdeforestation\b/i,
        /\bdegradation\b/i,
        /\bland[- ]use change\b/i,
        /\breference region\b/i,
        /\bdrivers?\b/i,
        /\btrend\b/i,
        /\brates?\b/i,
        /\binventory\b/i,
        /\bobserved\b/i,
      ],
      gapMessage: "No clear baseline justification basis was found, such as historical trends, drivers, or reference data.",
    },
    {
      name: "quantitative_context",
      required: true,
      patterns: [
        /\b\d+(?:\.\d+)?%?\s*(?:per|\/)\s*(?:year|annum|annual)\b/i,
        /\bannual\s+(?:loss|deforestation|degradation|change|rate|trend)\s+(?:of\s+)?\d+/i,
        /\bdeforestation\s+rate\s+(?:of\s+)?\d+/i,
        /\bdegradation\s+rate\s+(?:of\s+)?\d+/i,
        /\b\d+(?:\.\d+)?%?\s*(?:annual|per year|per annum)\b/i,
        /\b(historical|observed)\s+(?:deforestation|degradation|land.use|trend|rate|loss)\s+(?:of\s+)?\d+/i,
        /\b\d+(?:\.\d+)?\s*(?:ha|hectare|hectares|tCO2|tCO₂|tons?|tonnes?)\s*(?:per|\/)?\s*(?:year|annum)\b/i,
      ],
      gapMessage:
        "No quantitative baseline assumption, rate, or measurement clearly tied to baseline reasoning was found (dates, page numbers, or unrelated figures do not count).",
    },
  ],
  weakSignals: [],
};

const RIGHT_OF_USE_CONFIG: RubricConfig = {
  reviewAreaLabel: "right-of-use",
  followUpMissing: SECTIONLESS_REASON_BY_AREA.right_of_use.followUp,
  followUpDefault: [
    "Permit, title, lease, concession, or community agreement proving right of use",
    "Legal memo or annex describing compliance with applicable laws and regulatory frameworks",
  ],
  supportedThreshold: 7,
  partialThreshold: 2,
  strongSignalWeight: 2,
  weakSignalWeight: 1,
  requiredSignals: [
    {
      name: "rights_holder",
      required: true,
      patterns: [
        /\bright of use\b/i,
        /\blegal authority\b/i,
        /\bproperty rights?\b/i,
        /\bownership\b/i,
        /\bland tenure\b/i,
        /\bresource use rights?\b/i,
        /\bmanage the project area\b/i,
      ],
      gapMessage: "No clear statement of ownership, right of use, or legal authority over the project area was found.",
    },
    {
      name: "legal_compliance",
      required: true,
      patterns: [
        /\bcompliance with laws\b/i,
        /\blaws?\b/i,
        /\bstatutes?\b/i,
        /\bregulatory frameworks?\b/i,
        /\bpermits?\b/i,
        /\blicen[cs]es?\b/i,
        /\bapplicable regulations?\b/i,
      ],
      gapMessage: "No clear legal or regulatory compliance basis was found for the claimed right of use.",
    },
    {
      name: "documentary_support",
      required: true,
      patterns: [
        /\btitle\b/i,
        /\bdeed\b/i,
        /\bregistration\b/i,
        /\bconcession\b/i,
        /\blease\b/i,
        /\bagreement\b/i,
        /\bcontract\b/i,
        /\bdocumented\b/i,
      ],
      gapMessage: "No documentary basis such as a title, lease, concession, agreement, or registration was found in the matched text.",
    },
  ],
  weakSignals: [
    {
      name: "weak_legal_context",
      required: false,
      patterns: [
        /\blegal status\b/i,
        /\bapplicable\b/i,
        /\bframework\b/i,
        /\bauthority\b/i,
      ],
      gapMessage: "",
    },
  ],
};

const STAKEHOLDER_CONFIG: RubricConfig = {
  reviewAreaLabel: "stakeholder",
  followUpMissing: SECTIONLESS_REASON_BY_AREA.stakeholder.followUp,
  followUpDefault: [
    "Consultation records such as minutes, attendance logs, or outreach summaries",
    "Comment matrix, grievance log, or evidence showing how stakeholder feedback was addressed",
  ],
  supportedThreshold: 6,
  partialThreshold: 2,
  strongSignalWeight: 2,
  weakSignalWeight: 1,
  requiredSignals: [
    {
      name: "consultation_activity",
      required: true,
      patterns: [
        /\bconsult(?:ed|ation)\b/i,
        /\bengagement\b/i,
        /\bparticipation\b/i,
        /\bcommunity meetings?\b/i,
        /\bstakeholder meetings?\b/i,
        /\bworkshops?\b/i,
      ],
      gapMessage: "No clear consultation, engagement, or participation activity was found in the matched section text.",
    },
    {
      name: "participant_group",
      required: true,
      patterns: [
        /\blocal communities\b/i,
        /\bcommunity representatives?\b/i,
        /\bstakeholder representatives?\b/i,
        /\bindigenous peoples?\b/i,
        /\blandholders?\b/i,
      ],
      gapMessage: "No clear identification of who was consulted was found in the matched text.",
    },
    {
      name: "feedback_or_response",
      required: true,
      patterns: [
        /\bcomments?\b/i,
        /\bfeedback\b/i,
        /\bgrievances?\b/i,
        /\baddressed\b/i,
        /\bsummarized\b/i,
        /\bresponse\b/i,
      ],
      gapMessage: "No clear record of stakeholder comments, feedback, grievances, or responses was found.",
    },
  ],
  weakSignals: [
    {
      name: "weak_documentation",
      required: false,
      patterns: [
        /\bminutes\b/i,
        /\battendance\b/i,
        /\brecords?\b/i,
        /\blog\b/i,
      ],
      gapMessage: "",
    },
  ],
};

const CONFIG_BY_AREA: Record<ReviewRubricArea, RubricConfig> = {
  baseline: BASELINE_CONFIG,
  right_of_use: RIGHT_OF_USE_CONFIG,
  stakeholder: STAKEHOLDER_CONFIG,
};

function buildEvidenceSummary(headings: DocumentHeading[]): string {
  return headings
    .slice(0, 2)
    .map((heading) => {
      const preview = heading.bodyPreview || heading.bodyText || heading.title;
      return `§${heading.sectionNumber} ${heading.title}: ${preview.replace(/\s+/g, " ").trim()}`;
    })
    .join(" ");
}

function evaluateSignalGroup(text: string, group: SignalGroup): boolean {
  return group.patterns.some((pattern) => pattern.test(text));
}

export function evaluateReviewRubric(input: EvaluateReviewRubricInput): ReviewRubricResult {
  const headings = input.matchedHeadings.filter((heading) => heading.sectionNumber.trim().length > 0);
  if (headings.length === 0) {
    const sectionless = SECTIONLESS_REASON_BY_AREA[input.reviewArea];
    return {
      review_area: input.reviewArea,
      verdict: "missing",
      evidence_summary: sectionless.summary,
      cited_sections: [],
      gaps: sectionless.gaps,
      recommended_follow_up_documents: sectionless.followUp,
      confidence: 0,
    };
  }

  const config = CONFIG_BY_AREA[input.reviewArea];
  const combinedText = headings.map((heading) => `${heading.title}\n${heading.bodyText}`).join("\n\n");

  const matchedRequired = config.requiredSignals.filter((group) => evaluateSignalGroup(combinedText, group));
  const matchedWeak = config.weakSignals.filter((group) => evaluateSignalGroup(combinedText, group));
  const confidence =
    matchedRequired.length * config.strongSignalWeight + matchedWeak.length * config.weakSignalWeight;

  const gaps = config.requiredSignals
    .filter((group) => !evaluateSignalGroup(combinedText, group))
    .map((group) => group.gapMessage);

  const verdict: ReviewRubricVerdict =
    gaps.length === 0 && confidence >= config.supportedThreshold
      ? "supported"
      : confidence >= config.partialThreshold
        ? "partial"
        : "missing";

  const recommendedFollowUpDocuments =
    verdict === "missing" && headings.length === 0
      ? config.followUpMissing
      : config.followUpDefault;

  return {
    review_area: input.reviewArea,
    verdict,
    evidence_summary: buildEvidenceSummary(headings),
    cited_sections: headings.map((heading) => heading.sectionNumber),
    gaps,
    recommended_follow_up_documents: recommendedFollowUpDocuments,
    confidence,
  };
}

export type BaselineReviewResult = ReviewRubricResult & { review_area: "baseline" };

export function evaluateBaselineReview(input: { matchedHeadings: DocumentHeading[] }): BaselineReviewResult {
  return evaluateReviewRubric({
    reviewArea: "baseline",
    matchedHeadings: input.matchedHeadings,
  }) as BaselineReviewResult;
}
