export type RetrievalMetric = { key: string; value: number | string };
export type EngineResult = {
  id: string;
  section?: string;
  section_title?: string;
  sectionTitle?: string;
  text?: string;
  refs?: string[];
  sha256?: string;
  score?: number;
  methodology_id?: string;
  methodologyId?: string;
  methodology_version?: string;
  methodologyVersion?: string;
};
export type QueryResponse = {
  engineTag: string;
  metrics: RetrievalMetric[];
  results: EngineResult[];
};
