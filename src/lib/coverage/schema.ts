import { z } from "zod";

export const CoverageStatusSchema = z.enum(["covered", "uncovered", "weak"]);

export const CoverageRecordSchema = z.object({
  method_code: z.string().min(1),
  version: z.string().min(1),
  ruleId: z.string().min(1),
  status: CoverageStatusSchema,
  strength: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CoverageRecord = z.infer<typeof CoverageRecordSchema>;

export const CoverageSnapshotSchema = z.object({
  version: z.number(),
  method_code: z.string().min(1),
  method_version: z.string().min(1),
  records: z.array(CoverageRecordSchema),
});

export type CoverageSnapshot = z.infer<typeof CoverageSnapshotSchema>;
