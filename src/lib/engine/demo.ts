import { allPdfRecords } from "@/lib/pdf/metadata";
import type { QueryResponse } from "./types";

const FALLBACK_RESULTS: QueryResponse = {
  engineTag: process.env.NEXT_PUBLIC_ENGINE_TAG ?? "demo-baselines",
  metrics: [
    { key: "mode", value: "demo" },
    { key: "results", value: 0 },
  ],
  results: [],
};

export async function runDemoAdapter(query: string): Promise<QueryResponse> {
  const start = Date.now();
  try {
    const records = await allPdfRecords();
    if (!records.length) {
      return {
        ...FALLBACK_RESULTS,
        metrics: [
          { key: "mode", value: "demo" },
          { key: "results", value: 0 },
          { key: "latency_ms", value: Date.now() - start },
        ],
      };
    }

    const results = records.slice(0, Math.min(3, records.length)).map((record, idx) => ({
      id: record.id,
      section: `Demo match for "${query}" using ${record.sourcePath || record.fileRelative}`,
      section_title: record.id,
      text: `Demo evidence for "${query}".\nSource: ${record.sourcePath || record.fileRelative}`,
      refs: [record.sourcePath || record.fileRelative],
      sha256: record.sha256,
      score: Number((1 - idx * 0.1).toFixed(2)),
    }));

    return {
      engineTag: process.env.NEXT_PUBLIC_ENGINE_TAG ?? "demo-baselines",
      metrics: [
        { key: "mode", value: "demo" },
        { key: "query_length", value: query.length },
        { key: "latency_ms", value: Date.now() - start },
        { key: "results", value: results.length },
      ],
      results,
    };
  } catch (error) {
    return {
      engineTag: process.env.NEXT_PUBLIC_ENGINE_TAG ?? "demo-baselines",
      metrics: [
        { key: "mode", value: "demo" },
        { key: "latency_ms", value: Date.now() - start },
        { key: "error", value: error instanceof Error ? error.message : String(error) },
      ],
      results: [],
    };
  }
}
