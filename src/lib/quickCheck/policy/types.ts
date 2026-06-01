import { z } from "zod";
import type { ReviewArea, ReviewQuestionMatchStage } from "@/lib/quickCheck/retrieval/types";

export const REVIEW_AREA_KEYS = [
  "additionality",
  "baseline",
  "boundary",
  "deviations",
  "leakage",
  "monitoring",
  "right_of_use",
  "stakeholder",
  "general",
] as const satisfies readonly ReviewArea[];

export const reviewQuestionMatchStageSchema = z.enum([
  "exact_heading",
  "normalized_heading",
  "alias_heading",
  "semantic_fallback",
  "none",
]);

export const preferredSectionBoostSchema = z.object({
  sectionNumber: z.string().min(1),
  titleIncludes: z.string().min(1),
  score: z.number().int(),
});

export const titlePenaltySchema = z.object({
  titleIncludes: z.string().min(1),
  unlessTitleIncludes: z.string().min(1).optional(),
  score: z.number().int().nonnegative(),
});

export const reviewAreaPolicySchema = z.object({
  baseKeywords: z.array(z.string()),
  vm0007ExtraKeywords: z.array(z.string()).default([]),
  aliases: z.array(z.string()),
  preferredSections: z.array(preferredSectionBoostSchema).default([]),
  negativeSectionTerms: z.array(z.string()).default([]),
  titlePenalties: z.array(titlePenaltySchema).default([]),
  evidenceSignals: z.array(z.string()).default([]),
  semanticThreshold: z.number().int().nonnegative().default(6),
  enableAncestorExpansion: z.boolean().default(false),
});

export const reviewAreaSchema = z.enum(REVIEW_AREA_KEYS);

const reviewAreasShape = {
  additionality: reviewAreaPolicySchema,
  baseline: reviewAreaPolicySchema,
  boundary: reviewAreaPolicySchema,
  deviations: reviewAreaPolicySchema,
  leakage: reviewAreaPolicySchema,
  monitoring: reviewAreaPolicySchema,
  right_of_use: reviewAreaPolicySchema,
  stakeholder: reviewAreaPolicySchema,
  general: reviewAreaPolicySchema,
} satisfies Record<ReviewArea, typeof reviewAreaPolicySchema>;

export const reviewAreasSchema = z.object(reviewAreasShape).strict();

export const reviewPolicyConfigSchema = z.object({
  fallbackStages: z.array(reviewQuestionMatchStageSchema).min(4),
  reviewAreas: reviewAreasSchema,
});

export type PreferredSectionBoost = z.infer<typeof preferredSectionBoostSchema>;
export type TitlePenalty = z.infer<typeof titlePenaltySchema>;
export type ReviewAreaPolicyInput = z.input<typeof reviewAreaPolicySchema>;
export type ReviewAreaPolicy = z.infer<typeof reviewAreaPolicySchema>;
export type ReviewPolicyConfigInput = z.input<typeof reviewPolicyConfigSchema>;
export type ReviewPolicyConfig = z.infer<typeof reviewPolicyConfigSchema>;

export type ReviewPolicyAreaKey = ReviewArea;
export type ReviewPolicyStage = ReviewQuestionMatchStage;
