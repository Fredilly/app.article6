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
    label: "Purpose & claims",
    promptTemplate: "Summarize the business purpose and what the methodology claims to achieve.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "eligibility_constraints",
    label: "Eligibility constraints",
    promptTemplate: "List eligibility constraints and the practical implications for a project.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "required_data",
    label: "Required data",
    promptTemplate: "Identify what input data is required to apply this methodology.",
    requiredInputs: ["sections"],
  },
  {
    id: "calculation_steps",
    label: "Calculation steps",
    promptTemplate: "Outline the calculation steps and where to find them.",
    requiredInputs: ["sections", "rules"],
  },
  {
    id: "monitoring_reporting",
    label: "Monitoring & reporting",
    promptTemplate: "Summarize monitoring and reporting expectations and where they are defined.",
    requiredInputs: ["sections"],
  },
  {
    id: "changes_vs_previous",
    label: "Changes vs previous",
    promptTemplate: "Summarize changes vs the previous version and where they are documented.",
    requiredInputs: ["meta", "sections"],
  },
];

