export type AssistantInputKey = "rules" | "sections" | "rich" | "meta";

export type AssistantQuestionId =
  | "important_rules"
  | "evidence_first"
  | "where_defined"
  | "export_pack";

export type AssistantQuestion = {
  id: AssistantQuestionId;
  label: string;
  promptTemplate: string;
  requiredInputs: AssistantInputKey[];
};

export const ASSISTANT_QUESTIONS: AssistantQuestion[] = [
  {
    id: "important_rules",
    label: "Show the most important rules to verify",
    promptTemplate: "Highlight the highest priority rules and where they are defined.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "evidence_first",
    label: "What evidence should I gather first?",
    promptTemplate: "List the evidence to gather first and cite the defining rules/sections.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "where_defined",
    label: "Where in the document is this defined?",
    promptTemplate: "Locate the defining sections for a category and cite supporting rules.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "export_pack",
    label: "How do I export an audit-ready pack?",
    promptTemplate: "Explain how to export the audit-ready pack and cite the relevant evidence.",
    requiredInputs: ["sections", "rules"],
  },
];
