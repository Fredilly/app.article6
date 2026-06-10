import type { StandardPhase6QuestionId } from "@/lib/quickCheck/evalCorpus/types";

export const STANDARD_PHASE6_QUESTIONS: Record<StandardPhase6QuestionId, string> = {
  project_title: "What is the project title?",
  host_country: "What is the host country?",
  methodology: "What methodology is used?",
  baseline_scenario: "What is the baseline scenario?",
  monitoring: "What does the document say about monitoring?",
  leakage: "What does the document say about leakage?",
  additionality: "What does the document say about additionality?",
  marine_biodiversity_offsets: "What does the document say about marine biodiversity offsets?",
};
