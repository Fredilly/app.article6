export type RetrievalMetric = { key: string; value: number | string };
export type EngineResult = {
  id: string;
  section: string;
  refs?: string[];
  sha256?: string;
  score?: number;
};
export type QueryResponse = {
  engineTag: string;
  metrics: RetrievalMetric[];
  results: EngineResult[];
};
