import {
  reviewPolicyConfigSchema,
  type ReviewAreaPolicy,
  type ReviewPolicyConfigInput,
} from "@/lib/quickCheck/policy/types";
import type { ReviewArea, ReviewQuestionMatchStage } from "@/lib/quickCheck/retrieval/types";

const REVIEW_POLICY_CONFIG_RAW = {
  fallbackStages: [
    "exact_heading",
    "normalized_heading",
    "alias_heading",
    "semantic_fallback",
  ],
  reviewAreas: {
    additionality: {
      baseKeywords: [
        "additionality",
        "investment analysis",
        "barrier analysis",
        "common practice",
        "prior consideration",
        "CDM consideration",
      ],
      aliases: [
        "B.3 additionality",
        "additionality",
      ],
      negativeSectionTerms: [
        "grid emission factor",
        "parameter",
        "default value",
        "data and parameters",
        "emission reductions",
      ],
      evidenceSignals: [],
    },
    baseline: {
      baseKeywords: [
        "baseline",
        "baseline scenario",
        "without-project",
        "without project",
        "land use scenario",
        "identification of baseline",
        "alternatives analysis",
      ],
      aliases: [
        "B.2 baseline scenario",
        "baseline scenario",
      ],
      negativeSectionTerms: [
        "grid emission factor",
        "parameter",
        "default value",
        "data and parameters",
        "emission reductions",
      ],
      evidenceSignals: [],
    },
    boundary: {
      baseKeywords: ["boundary", "project area", "project zone", "geographic boundary", "project location"],
      aliases: [],
      evidenceSignals: [],
    },
    deviations: {
      baseKeywords: ["deviations", "deviation"],
      aliases: [
        "methodology deviations",
        "2.6 methodology deviations",
        "deviation from methodology",
      ],
      evidenceSignals: [],
    },
    leakage: {
      baseKeywords: [
        "leakage",
        "leakage belt",
        "leakage emissions",
        "project leakage",
        "activity shifting leakage",
      ],
      aliases: [
        "leakage",
        "leakage management",
        "3.3 leakage",
        "E.2 leakage",
        "activity shifting leakage",
      ],
      evidenceSignals: [],
      negativeSectionTerms: [
        "grid emission factor",
        "parameter",
        "default value",
        "data and parameters",
        "emission reductions",
      ],
    },
    monitoring: {
      baseKeywords: ["monitoring", "monitoring plan", "data and parameters"],
      aliases: [
        "monitoring plan",
        "4.3 monitoring plan",
        "D.1 monitoring methodology",
        "monitoring methodology",
        "monitoring procedures",
        "monitoring approach",
      ],
      preferredSections: [
        {
          sectionNumber: "4.3",
          titleIncludes: "monitoring plan",
          score: 16,
        },
      ],
      titlePenalties: [
        {
          titleIncludes: "monitoring equipment",
          unlessTitleIncludes: "monitoring plan",
          score: 10,
        },
      ],
      evidenceSignals: [],
      enableAncestorExpansion: true,
    },
    right_of_use: {
      baseKeywords: [
        "legal status",
        "property rights",
        "ownership",
        "right of use",
        "land tenure",
        "carbon rights",
        "compliance",
        "laws",
        "statutes",
        "regulatory frameworks",
      ],
      vm0007ExtraKeywords: [
        "compliance with laws",
        "compliance with laws statutes and other regulatory frameworks",
        "right of use",
        "ownership",
        "land and resource use rights",
      ],
      aliases: [],
      evidenceSignals: [],
    },
    stakeholder: {
      baseKeywords: [
        "stakeholder",
        "stakeholder engagement",
        "stakeholder consultation",
        "stakeholder participation",
        "stakeholder comments",
        "local communities",
        "community consultation",
      ],
      vm0007ExtraKeywords: [
        "stakeholder comments",
        "consultation",
        "participation",
        "local communities",
      ],
      aliases: [
        "stakeholder comments",
        "stakeholder consultation",
        "project awareness",
        "fpic",
        "free prior and informed consent",
        "grievance procedure",
        "community meetings",
      ],
      evidenceSignals: [
        "fpic",
        "free prior and informed consent",
        "grievance procedure",
        "community meetings",
        "project awareness",
      ],
    },
    general: {
      baseKeywords: [],
      aliases: [],
      evidenceSignals: [],
    },
  },
} satisfies ReviewPolicyConfigInput;

export const REVIEW_POLICY_CONFIG = reviewPolicyConfigSchema.parse(REVIEW_POLICY_CONFIG_RAW);

const VM0007_STYLE_IDS = new Set(["VM0007", "PD_REDD_V1_130"]);

export function isVm0007StylePdd(methodologyId: string, rawPddText?: string): boolean {
  if (VM0007_STYLE_IDS.has(methodologyId.trim().toUpperCase())) return true;
  const text = rawPddText?.toUpperCase() ?? "";
  return text.includes("PD_REDD_V1_130") || text.includes("VM0007");
}

export function getReviewAreaPolicy(reviewArea: ReviewArea): ReviewAreaPolicy {
  return REVIEW_POLICY_CONFIG.reviewAreas[reviewArea];
}

export function getReviewAreaKeywords(input: {
  reviewArea: ReviewArea;
  methodologyId: string;
  rawPddText?: string;
}): string[] {
  const policy = getReviewAreaPolicy(input.reviewArea);
  if (!isVm0007StylePdd(input.methodologyId, input.rawPddText)) {
    return policy.baseKeywords;
  }
  return [...policy.baseKeywords, ...policy.vm0007ExtraKeywords];
}

export function getReviewAreaAliases(reviewArea: ReviewArea): string[] {
  return getReviewAreaPolicy(reviewArea).aliases;
}

export function getSemanticThreshold(reviewArea: ReviewArea): number {
  return getReviewAreaPolicy(reviewArea).semanticThreshold;
}

export function getSemanticSignals(reviewArea: ReviewArea): string[] {
  return getReviewAreaPolicy(reviewArea).evidenceSignals;
}

export function getPreferredSectionBoosts(reviewArea: ReviewArea) {
  return getReviewAreaPolicy(reviewArea).preferredSections;
}

export function getTitlePenalties(reviewArea: ReviewArea) {
  return getReviewAreaPolicy(reviewArea).titlePenalties;
}

export function getNegativeSectionTerms(reviewArea: ReviewArea): string[] {
  return getReviewAreaPolicy(reviewArea).negativeSectionTerms;
}

export function shouldExpandAncestors(reviewArea: ReviewArea): boolean {
  return getReviewAreaPolicy(reviewArea).enableAncestorExpansion;
}

export function getFallbackStages(): ReviewQuestionMatchStage[] {
  return REVIEW_POLICY_CONFIG.fallbackStages;
}
