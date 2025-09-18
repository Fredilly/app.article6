import { z } from "zod";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema)
  ])
);

export const QueryRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query text is required")
    .max(10_000, "Query text is too long")
});

export const QueryResultSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    snippet: z.string().optional(),
    sha256: z
      .string()
      .regex(/^[A-Fa-f0-9]{64}$/)
      .optional(),
    sourcePath: z.string().optional(),
    url: z.string().url().optional(),
    pdfId: z.string().optional(),
    score: z.number().optional(),
    metadata: z.record(JsonValueSchema).optional()
  })
  .passthrough();

export const QueryResponseSchema = z
  .object({
    engineTag: z.string(),
    metrics: z.record(JsonValueSchema).default({}),
    results: z.array(QueryResultSchema),
    warnings: z.array(z.string()).optional(),
    meta: z.record(JsonValueSchema).optional()
  })
  .passthrough();

export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
export type QueryResponse = z.infer<typeof QueryResponseSchema>;
