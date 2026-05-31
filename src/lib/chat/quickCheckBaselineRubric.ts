import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";

export type BaselineReviewVerdict = "supported" | "partial" | "missing" | "needs_review";

export type BaselineReviewResult = {
  review_area: "baseline";
  verdict: BaselineReviewVerdict;
  evidence_summary: string;
  cited_sections: string[];
  gaps: string[];
  recommended_follow_up_documents: string[];
};

type EvaluateBaselineReviewInput = {
  matchedHeadings: DocumentHeading[];
};

const BASELINE_SCENARIO_SIGNALS = [
  "baseline scenario",
  "without-project",
  "without project",
  "absence of the project",
  "most likely land-use scenario",
  "most likely land use scenario",
  "business as usual",
];

const BASELINE_EVIDENCE_SIGNALS = [
  "historical",
  "satellite",
  "remote sensing",
  "deforestation",
  "degradation",
  "land-use change",
  "land use change",
  "reference region",
  "drivers",
  "trend",
  "rates",
  "inventory",
  "observed",
];

const BASELINE_QUANT_SIGNAL = /\b\d+(?:\.\d+)?%?\b/;

const BASELINE_FOLLOW_UP_DEFAULT = [
  "Historical land-use change analysis or baseline modelling note",
  "Remote sensing or inventory source used to justify baseline assumptions",
];

function normalizeForSignal(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function collectMatchedSignalLabels(text: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => text.includes(phrase));
}

function buildEvidenceSummary(headings: DocumentHeading[]): string {
  const fragments = headings
    .slice(0, 2)
    .map((heading) => {
      const preview = heading.bodyPreview || heading.bodyText || heading.title;
      const singleLine = preview.replace(/\s+/g, " ").trim();
      return `§${heading.sectionNumber} ${heading.title}: ${singleLine}`;
    });
  return fragments.join(" ");
}

export function evaluateBaselineReview(input: EvaluateBaselineReviewInput): BaselineReviewResult {
  const headings = input.matchedHeadings.filter((heading) => heading.sectionNumber.trim().length > 0);
  if (headings.length === 0) {
    return {
      review_area: "baseline",
      verdict: "missing",
      evidence_summary: "No baseline-matched document section was recovered from the uploaded PDD heading index.",
      cited_sections: [],
      gaps: [
        "No uploaded PDD section heading matched the baseline review question.",
        "Quick Check could not verify a baseline scenario discussion from document-grounded sections.",
      ],
      recommended_follow_up_documents: [
        "PDD section or annex describing the baseline scenario / without-project case",
        "Historical land-use change analysis or baseline modelling note",
      ],
    };
  }

  const combinedText = headings
    .map((heading) => `${heading.title}\n${heading.bodyText}`)
    .join("\n\n");
  const normalized = normalizeForSignal(combinedText);
  const scenarioSignals = collectMatchedSignalLabels(normalized, BASELINE_SCENARIO_SIGNALS);
  const evidenceSignals = collectMatchedSignalLabels(normalized, BASELINE_EVIDENCE_SIGNALS);
  const hasQuantitativeIndicator = BASELINE_QUANT_SIGNAL.test(combinedText);

  const gaps: string[] = [];
  if (scenarioSignals.length === 0) {
    gaps.push("No clear baseline or without-project scenario statement was found in the matched section text.");
  }
  if (evidenceSignals.length === 0) {
    gaps.push("No clear baseline justification basis was found, such as historical trends, drivers, or reference data.");
  }
  if (!hasQuantitativeIndicator) {
    gaps.push("No quantitative baseline assumption, rate, or measurement was found in the matched section text.");
  }

  const verdict: BaselineReviewVerdict =
    scenarioSignals.length > 0 && evidenceSignals.length > 0 && hasQuantitativeIndicator
      ? "supported"
      : scenarioSignals.length > 0
        ? "partial"
        : "needs_review";

  const followUps = gaps.length > 0
    ? BASELINE_FOLLOW_UP_DEFAULT
    : ["Supporting source for baseline assumptions, such as remote sensing or inventory evidence"];

  return {
    review_area: "baseline",
    verdict,
    evidence_summary: buildEvidenceSummary(headings),
    cited_sections: headings.map((heading) => heading.sectionNumber),
    gaps,
    recommended_follow_up_documents: followUps,
  };
}
