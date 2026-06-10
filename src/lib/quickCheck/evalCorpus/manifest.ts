import fs from "fs";
import path from "path";
import { z } from "zod";
import type { EvalCorpusManifest } from "@/lib/quickCheck/evalCorpus/types";
import { STANDARD_PHASE6_QUESTION_IDS } from "@/lib/quickCheck/evalCorpus/types";

const goldEvidenceSchema = z.object({
  pages: z.array(z.number().int().positive()).optional(),
  spanAnchors: z.array(z.string().min(1)).optional(),
  sectionHints: z.array(z.string().min(1)).optional(),
}).strict();

const questionExpectationSchema = z.object({
  expectedStatus: z.enum(["answered", "unclear", "no_evidence"]),
  expectedRoute: z.enum(["project_fact_contract", "section_index", "table_index", "lexical_retrieval", "fallback"]).optional(),
  expectedEvidenceEmpty: z.boolean().optional(),
  goldEvidence: goldEvidenceSchema.optional(),
}).strict();

const questionExpectationsSchema = z.object(
  Object.fromEntries(STANDARD_PHASE6_QUESTION_IDS.map((questionId) => [questionId, questionExpectationSchema])) as Record<
    (typeof STANDARD_PHASE6_QUESTION_IDS)[number],
    typeof questionExpectationSchema
  >,
).strict();

const fixtureSchema = z.object({
  id: z.string().min(1),
  fixturePath: z.string().min(1),
  kind: z.enum(["text", "json-pages"]),
  methodologyContext: z.object({
    methodologyId: z.string().min(1),
    methodologyVersion: z.string().min(1),
  }).strict(),
  gold: z.object({
    documentFamily: z.string().min(1),
    projectTitle: z.string().nullable().optional(),
    hostCountry: z.string().nullable().optional(),
    projectCountry: z.string().nullable().optional(),
    methodology: z.string().nullable().optional(),
    creditingPeriod: z.string().nullable().optional(),
    reportingPeriod: z.string().nullable().optional(),
    baselineSection: z.string().nullable().optional(),
    monitoringSection: z.string().nullable().optional(),
    leakageSection: z.string().nullable().optional(),
    additionalitySection: z.string().nullable().optional(),
    unsupportedQuestionExpectation: questionExpectationSchema,
    questionExpectations: questionExpectationsSchema,
  }).strict(),
  notes: z.string().optional(),
}).strict();

const manifestSchema = z.object({
  manifestVersion: z.literal(1),
  corpusId: z.string().min(1),
  fixtures: z.array(fixtureSchema).min(1),
  thresholds: z.object({
    firstPassSuccessRate: z.number().min(0).max(1),
    provenanceCorrectness: z.number().min(0).max(1),
    unsupportedRejectionRate: z.number().min(0).max(1),
    hallucinatedAnswerRate: z.number().min(0).max(1),
    regressionCount: z.number().int().min(0),
  }).optional(),
}).strict();

export function loadEvalCorpusManifest(manifestPath: string): EvalCorpusManifest {
  const absolutePath = path.resolve(manifestPath);
  const raw = fs.readFileSync(absolutePath, "utf-8");
  return manifestSchema.parse(JSON.parse(raw)) as EvalCorpusManifest;
}

export function readEvalCorpusFixture(repoRoot: string, fixturePath: string, kind: "text" | "json-pages"): string {
  const absolutePath = path.resolve(repoRoot, fixturePath);
  if (kind === "json-pages") {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as {
      pages?: Array<{ text?: string; rawText?: string }>;
    };
    return (parsed.pages ?? [])
      .map((page) => page.text ?? page.rawText ?? "")
      .filter(Boolean)
      .join("\n\n");
  }
  return fs.readFileSync(absolutePath, "utf-8");
}
