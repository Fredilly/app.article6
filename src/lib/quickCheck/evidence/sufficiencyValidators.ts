import type { ReviewArea } from "@/lib/quickCheck/retrieval/types";
import type { ResolvedSpan } from "@/lib/quickCheck/evidence/resolveEvidenceSpans";

export type EvidenceSufficiencyResult = {
  sufficient: boolean;
  reason: string;
  warnings: string[];
  downgradeTo?: "unclear" | "no_evidence";
};

type SufficiencyInput = {
  reviewArea: ReviewArea;
  answerText: string;
  quotes: string[];
  pages: number[];
  resolvedSpans: ResolvedSpan[];
  route: string;
  confidence: number;
};

// ── TOC / boilerplate / preamble keywords ────────────────────────────────

const TOC_KEYWORDS = /\btable of contents\b/i;
const BOILERPLATE_TERMS = [
  "this report was prepared",
  "this document was prepared",
  "all rights reserved",
  "confidential",
  "disclaimer",
  "date of issue",
  "report id",
  "report title",
];
const METHODOLOGY_PREAMBLE = [
  "this methodology was developed",
  "methodology framework",
  "methodological approach",
  "this methodology applies to",
  "the methodology is based on",
];

// ── Individual validators ─────────────────────────────────────────────────

function validateAdditionality(input: SufficiencyInput): EvidenceSufficiencyResult {
  const headingText = input.resolvedSpans
    .map((s) => [s.heading, ...s.headingPath].join(" "))
    .join(" ");
  const combined = [input.answerText, headingText, ...input.quotes].join(" ");
  const lower = combined.toLowerCase();

  // Reject generic methodology paragraphs that merely mention
  // additionality in context of "methodology requires additionality assessment"
  if (
    lower.length < 60
    || lower.split(/\s+/).filter(Boolean).length < 8
  ) {
    return {
      sufficient: false,
      reason: "Evidence text too short to demonstrate additionality",
      warnings: ["insufficient_evidence_text"],
      downgradeTo: "unclear",
    };
  }

  // Reject TOC-only
  if (TOC_KEYWORDS.test(lower) || lower.trim().startsWith("table of contents")) {
    return {
      sufficient: false,
      reason: "Additionality evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Reject methodology preamble
  if (METHODOLOGY_PREAMBLE.some((term) => lower.includes(term))) {
    return {
      sufficient: false,
      reason: "Additionality evidence is methodology preamble, not project-specific",
      warnings: ["methodology_preamble_evidence"],
      downgradeTo: "unclear",
    };
  }

  // Must contain specific additionality discussion
  const hasAdditionality = /\badditionality\b/i.test(lower);
  const hasDemonstration = /\bdemonstrat/i.test(lower) || /\bjustif/i.test(lower) || /\bprove\b/i.test(lower);
  const hasSpecific = /\bwould not\b/i.test(lower)
    || /\bwithout carbon\b/i.test(lower)
    || /\bbarrier\b/i.test(lower)
    || /\binvestment analysis\b/i.test(lower)
    || /\bcommon practice\b/i.test(lower);

  if (hasAdditionality && (hasDemonstration || hasSpecific)) {
    return { sufficient: true, reason: "Additionality evidence is specific and project-grounded", warnings: [] };
  }

  return {
    sufficient: false,
    reason: "Additionality evidence is generic — no specific demonstration details found",
    warnings: ["generic_evidence"],
    downgradeTo: "unclear",
  };
}

function validateBaseline(input: SufficiencyInput): EvidenceSufficiencyResult {
  const combined = [input.answerText, ...input.quotes].join(" ");
  const lower = combined.toLowerCase();

  if (lower.length < 60 || lower.split(/\s+/).filter(Boolean).length < 8) {
    return {
      sufficient: false,
      reason: "Evidence text too short to describe the baseline scenario",
      warnings: ["insufficient_evidence_text"],
      downgradeTo: "unclear",
    };
  }

  // Reject TOC-only
  if (TOC_KEYWORDS.test(lower) || lower.trim().startsWith("table of contents")) {
    return {
      sufficient: false,
      reason: "Baseline evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Check for scenario narrative before deciding whether calculation
  // terms are disqualifying.  A baseline scenario section that discusses
  // emission factors as part of the scenario description is valid.
  const hasScenario = /\bscenario\b/i.test(lower) || /\bwithout.?(?:the)?\s*project\b/i.test(lower);
  const hasNarrativeSignal = /\bcontinu/i.test(lower)
    || /\bdeforest/i.test(lower)
    || /\bland use\b/i.test(lower)
    || /\bbusiness.?(?:as)?\s*usual\b/i.test(lower)
    || /\bcurrent practice\b/i.test(lower)
    || /\bhistorical\b/i.test(lower);
  const hasCalcTerms =
    /\b(?:emission factor|grid emission|om calculation|bm calculation|combined margin)\b/i.test(lower)
    || /\bex.?(?:ante)?\s*calculation\b/i.test(lower);

  // Calculation-only text (no scenario narrative) is insufficient.
  // But calculation terms alongside a valid scenario description
  // are fine — many baseline sections include emission numbers.
  if (hasCalcTerms && !hasScenario && !hasNarrativeSignal) {
    return {
      sufficient: false,
      reason: "Baseline evidence is calculation/emission-factor data without scenario narrative",
      warnings: ["calculation_table_evidence"],
      downgradeTo: "unclear",
    };
  }

  const hasDescription = hasNarrativeSignal || lower.split(/\s+/).filter(Boolean).length > 30;

  if (hasScenario && hasDescription) {
    return { sufficient: true, reason: "Baseline evidence describes the scenario with specific context", warnings: [] };
  }

  return {
    sufficient: false,
    reason: "Baseline evidence is too generic — no scenario description found",
    warnings: ["generic_evidence"],
    downgradeTo: "unclear",
  };
}

function validateMonitoring(input: SufficiencyInput): EvidenceSufficiencyResult {
  const combined = [input.answerText, ...input.quotes].join(" ");
  const lower = combined.toLowerCase();

  if (lower.length < 40) {
    return {
      sufficient: false,
      reason: "Evidence text too short for monitoring",
      warnings: ["insufficient_evidence_text"],
      downgradeTo: "unclear",
    };
  }

  if (TOC_KEYWORDS.test(lower)) {
    return {
      sufficient: false,
      reason: "Monitoring evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Must contain monitoring substance, not just "monitoring" in a heading
  const hasPlan = /\bmonitoring plan\b/i.test(lower) || /\bplan for monitoring\b/i.test(lower);
  const hasMethod = /\bmonitoring methodology\b/i.test(lower) || /\bmonitoring approach\b/i.test(lower);
  const hasProcedure = /\bmonitoring procedures?\b/i.test(lower) || /\bprocedure for monitoring\b/i.test(lower);
  const hasParameter = /\b(?:parameter|indicator|variable)\b/i.test(lower) || /\bdata (?:to be )?monitored\b/i.test(lower);
  const hasFrequency = /\b(?:annual(?:ly)?|quarterly|monthly|continuous|every|each year|each monitoring)\b/i.test(lower);
  const hasQaQc = /\bqa\b/i.test(lower) || /\bqc\b/i.test(lower)
    || /\bquality (?:assurance|control)\b/i.test(lower);

  if (hasPlan || hasMethod || hasProcedure || hasParameter || hasFrequency || hasQaQc) {
    return { sufficient: true, reason: "Monitoring evidence contains substantive monitoring details", warnings: [] };
  }

  return {
    sufficient: false,
    reason: "Monitoring evidence is too generic — no plan, parameter, or procedure details found",
    warnings: ["generic_evidence"],
    downgradeTo: "unclear",
  };
}

function validateLeakage(input: SufficiencyInput): EvidenceSufficiencyResult {
  const combined = [input.answerText, ...input.quotes].join(" ");
  const lower = combined.toLowerCase();

  if (lower.length < 40 || lower.split(/\s+/).filter(Boolean).length < 6) {
    return {
      sufficient: false,
      reason: "Evidence text too short for leakage assessment",
      warnings: ["insufficient_evidence_text"],
      downgradeTo: "unclear",
    };
  }

  if (TOC_KEYWORDS.test(lower)) {
    return {
      sufficient: false,
      reason: "Leakage evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Leakage must describe actual leakage, not just define it
  const hasSpecific = /\bleakage (?:emissions?|assessment|management)\b/i.test(lower)
    || /\bactivity.?(?:shifting)?\s*leakage\b/i.test(lower)
    || /\bmarket leakage\b/i.test(lower)
    || /\bnegligible\b/i.test(lower)
    || /\bnot expected\b/i.test(lower)
    || /\bno leakage\b/i.test(lower)
    || lower.split(/\s+/).filter(Boolean).length > 25;

  if (hasSpecific) {
    return { sufficient: true, reason: "Leakage evidence is specific and substantive", warnings: [] };
  }

  return {
    sufficient: false,
    reason: "Leakage evidence is a single generic mention — no specific assessment found",
    warnings: ["generic_evidence"],
    downgradeTo: "unclear",
  };
}

function validateGeneric(input: SufficiencyInput): EvidenceSufficiencyResult {
  const combined = [input.answerText, ...input.quotes].join(" ");
  const lower = combined.toLowerCase();

  if (TOC_KEYWORDS.test(lower)) {
    return {
      sufficient: false,
      reason: "Evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Generic metadata cites and boilerplate are not sufficient
  const isBoilerplate = BOILERPLATE_TERMS.some((term) => lower.includes(term));
  if (isBoilerplate) {
    return {
      sufficient: false,
      reason: "Evidence is document boilerplate/metadata, not substantive",
      warnings: ["boilerplate_evidence"],
      downgradeTo: "unclear",
    };
  }

  return { sufficient: true, reason: "Generic evidence passed basic quality checks", warnings: [] };
}

// ── Main evaluator ────────────────────────────────────────────────────────

export function evaluateEvidenceSufficiency(input: SufficiencyInput): EvidenceSufficiencyResult {
  // Provenance requirement: must have evidence span IDs
  if (input.resolvedSpans.length === 0) {
    return {
      sufficient: false,
      reason: "No resolved evidence spans — cannot assert sufficiency",
      warnings: ["missing_resolved_spans"],
      downgradeTo: "no_evidence",
    };
  }

  // Page provenance
  if (input.pages.length === 0) {
    return {
      sufficient: false,
      reason: "No page provenance — evidence is ungrounded",
      warnings: ["missing_page_provenance"],
      downgradeTo: "unclear",
    };
  }

  // TOC-only check (before check-specific logic)
  const combined = [input.answerText, ...input.quotes].join(" ");
  const lowerCombined = combined.toLowerCase();
  const hasTocHeading = input.resolvedSpans.some(
    (s) => TOC_KEYWORDS.test(s.heading ?? "") || s.headingPath.some((hp) => TOC_KEYWORDS.test(hp)),
  );
  const isTocOnly = hasTocHeading
    || TOC_KEYWORDS.test(lowerCombined)
    || lowerCombined.trim().startsWith("table of contents");
  if (isTocOnly) {
    return {
      sufficient: false,
      reason: "Evidence is TOC-only",
      warnings: ["toc_only_evidence"],
      downgradeTo: "no_evidence",
    };
  }

  // Check-specific validators
  switch (input.reviewArea) {
    case "additionality":
      return validateAdditionality(input);
    case "baseline":
      return validateBaseline(input);
    case "monitoring":
      return validateMonitoring(input);
    case "leakage":
      return validateLeakage(input);
    default:
      return validateGeneric(input);
  }
}
