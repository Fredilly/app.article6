export type AssistantInputKey = "rules" | "sections" | "rich" | "meta";

export type AssistantQuestionId =
  | "purpose_claims"
  | "eligibility_constraints"
  | "required_data"
  | "calculation_steps"
  | "monitoring_reporting"
  | "changes_vs_previous";

export type AssistantQuestion = {
  id: AssistantQuestionId;
  label: string;
  promptTemplate: string;
  requiredInputs: AssistantInputKey[];
};

export const ASSISTANT_QUESTIONS: AssistantQuestion[] = [
  {
    id: "purpose_claims",
    label: "Explain this method in plain English",
    promptTemplate: "Explain this methodology in plain English without adding facts not present in the evidence.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "eligibility_constraints",
    label: "What would an auditor check?",
    promptTemplate:
      "List what an auditor would check, using only requirements and definitions found in the evidence.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "required_data",
    label: "What evidence do I need for this method?",
    promptTemplate:
      "List the evidence and inputs required to apply this methodology, grounded in the evidence text (no guesses).",
    requiredInputs: ["sections"],
  },
  {
    id: "calculation_steps",
    label: "Show the most important rules to validate first",
    promptTemplate:
      "Identify the most important requirements to validate first, and where they are defined in the evidence.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "monitoring_reporting",
    label: "Which sections define monitoring requirements?",
    promptTemplate:
      "Summarize monitoring and reporting expectations and point to the defining sections and rules.",
    requiredInputs: ["sections"],
  },
  {
    id: "changes_vs_previous",
    label: "Changes vs previous",
    promptTemplate: "Summarize changes vs the previous version and where they are documented.",
    requiredInputs: ["meta", "sections"],
  },
];
