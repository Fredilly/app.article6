export { loadEvalCorpusManifest, readEvalCorpusFixture } from "@/lib/quickCheck/evalCorpus/manifest";
export { runQuickCheckEvalCorpus, formatQuickCheckEvalCorpusReport, checkEvalCorpusThresholds, generateActiveCorpusReport, formatActiveCorpusReport } from "@/lib/quickCheck/evalCorpus/runner";
export type { ActiveCorpusBreakdown, ActiveCorpusReport } from "@/lib/quickCheck/evalCorpus/runner";
export { STANDARD_PHASE6_QUESTIONS } from "@/lib/quickCheck/evalCorpus/standardQuestions";
export type {
  EvalCorpusManifest,
  EvalCorpusReport,
  EvalCorpusThresholds,
  StandardPhase6QuestionId,
} from "@/lib/quickCheck/evalCorpus/types";
export { DEFAULT_STRICT_THRESHOLDS } from "@/lib/quickCheck/evalCorpus/types";
export {
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
} from "@/lib/quickCheck/evalCorpus/bakeoff";
export type {
  ParserBakeoffParserEntry,
  ParserBakeoffPerPdfMetrics,
  ParserBakeoffPdfResult,
  ParserBakeoffEvalComparison,
  ParserBakeoffScorecard,
} from "@/lib/quickCheck/evalCorpus/bakeoff";
