import type { DeterministicRouterRoute, DeterministicRouterStatus } from "@/lib/quickCheck/retrieval/types";
import type { DocumentFamily } from "@/lib/documentParsing";

export const STANDARD_PHASE6_QUESTION_IDS = [
  "project_title",
  "host_country",
  "methodology",
  "baseline_scenario",
  "monitoring",
  "leakage",
  "additionality",
  "marine_biodiversity_offsets",
] as const;

export type StandardPhase6QuestionId = (typeof STANDARD_PHASE6_QUESTION_IDS)[number];

export type EvalCorpusFixtureKind = "text" | "json-pages";

export type EvalCorpusMethodologyContext = {
  methodologyId: string;
  methodologyVersion: string;
};

export type EvalCorpusGoldEvidence = {
  pages?: number[];
  spanAnchors?: string[];
  sectionHints?: string[];
};

export type EvalCorpusQuestionExpectation = {
  expectedStatus: DeterministicRouterStatus;
  expectedRoute?: DeterministicRouterRoute;
  expectedEvidenceEmpty?: boolean;
  goldEvidence?: EvalCorpusGoldEvidence;
};

export type EvalCorpusFixtureGold = {
  documentFamily: DocumentFamily;
  projectTitle?: string | null;
  hostCountry?: string | null;
  projectCountry?: string | null;
  methodology?: string | null;
  creditingPeriod?: string | null;
  reportingPeriod?: string | null;
  baselineSection?: string | null;
  monitoringSection?: string | null;
  leakageSection?: string | null;
  additionalitySection?: string | null;
  unsupportedQuestionExpectation: EvalCorpusQuestionExpectation;
  questionExpectations: Record<StandardPhase6QuestionId, EvalCorpusQuestionExpectation>;
};

export type EvalCorpusFixtureManifestEntry = {
  id: string;
  fixturePath: string;
  kind: EvalCorpusFixtureKind;
  methodologyContext: EvalCorpusMethodologyContext;
  gold: EvalCorpusFixtureGold;
  notes?: string;
};

export type EvalCorpusManifest = {
  manifestVersion: 1;
  corpusId: string;
  fixtures: EvalCorpusFixtureManifestEntry[];
  thresholds?: EvalCorpusThresholds;
};

export type EvalMetric = {
  passed: number;
  total: number;
  rate: number;
};

export type EvalCorpusThresholds = {
  firstPassSuccessRate: number;
  provenanceCorrectness: number;
  unsupportedRejectionRate: number;
  hallucinatedAnswerRate: number;
  regressionCount: number;
};

export const DEFAULT_STRICT_THRESHOLDS: EvalCorpusThresholds = {
  firstPassSuccessRate: 0.85,
  provenanceCorrectness: 0.85,
  unsupportedRejectionRate: 1.0,
  hallucinatedAnswerRate: 0.0,
  regressionCount: 0,
};

export type EvalCorpusFailure = {
  fixtureId: string;
  category: string;
  questionId?: StandardPhase6QuestionId | "fact_contract";
  message: string;
};

export type EvalCorpusQuestionResult = {
  questionId: StandardPhase6QuestionId;
  passed: boolean;
  actualStatus: DeterministicRouterStatus;
  actualRoute: DeterministicRouterRoute;
  failures: string[];
};

export type EvalCorpusFixtureResult = {
  fixtureId: string;
  passed: boolean;
  factFailures: string[];
  questionResults: EvalCorpusQuestionResult[];
};

export type EvalCorpusReport = {
  corpusId: string;
  fixtureCount: number;
  fixtureResults: EvalCorpusFixtureResult[];
  failures: EvalCorpusFailure[];
  metrics: {
    factExtractionAccuracy: EvalMetric;
    provenanceCorrectness: EvalMetric;
    sectionRetrievalPrecision: EvalMetric;
    sectionRetrievalRecall: EvalMetric;
    unsupportedRejectionRate: EvalMetric;
    noEvidenceFalseNegativeRate: EvalMetric;
    hallucinatedAnswerRate: EvalMetric;
    firstPassSuccessRate: EvalMetric;
    regressionCount: number;
  };
};
