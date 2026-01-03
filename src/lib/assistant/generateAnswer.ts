import type { AssistantQuestionId } from "@/lib/assistant/questions";

type RuleSummary = { id: string; title: string; snippet: string };
type SectionSummary = { id: string; title: string; textSnippet?: string };

type EvidenceItem =
  | { type: "rule"; id: string; title?: string; href?: string }
  | { type: "section"; id: string; title?: string; href?: string }
  | { type: "citation"; id: string; title?: string; href?: string };

export type AssistantAnswer = {
  question_id: AssistantQuestionId;
  answer_md: string;
  evidence: EvidenceItem[];
  assumptions: string[];
  next_actions: string[];
  provenance: { pack?: string; generated_at?: string; repo_sha?: string };
};

function topMatches<T>(
  items: T[],
  toText: (item: T) => string,
  keywords: string[],
  limit: number,
): T[] {
  const scored = items
    .map((item) => {
      const text = toText(item).toLowerCase();
      const score = keywords.reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0);
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((row) => row.item);
}

function buildMissingAnswer(questionId: AssistantQuestionId, missing: string[], provenance: AssistantAnswer["provenance"]): AssistantAnswer {
  return {
    question_id: questionId,
    answer_md: `Not enough evidence loaded.\n\nMissing: ${missing.join(", ")}`,
    evidence: [],
    assumptions: [],
    next_actions: [
      "Load Rules and Sections (and Rich evidence if available).",
      "Retry this question after evidence loads.",
    ],
    provenance,
  };
}

function hrefForRule(code: string, ver: string, ruleId: string) {
  return `/m/${encodeURIComponent(code)}/v/${encodeURIComponent(ver)}?rule=${encodeURIComponent(ruleId)}`;
}

function hrefForSection(code: string, ver: string, sectionId: string) {
  return `/m/${encodeURIComponent(code)}/v/${encodeURIComponent(ver)}?section=${encodeURIComponent(sectionId)}`;
}

export function generateAnswer(input: {
  questionId: AssistantQuestionId;
  methodCode: string;
  version: string;
  rules: RuleSummary[];
  sections: SectionSummary[];
  rich?: unknown | null;
  meta?: unknown | null;
  provenance: { pack?: string; generated_at?: string; repo_sha?: string };
}): AssistantAnswer {
  const { questionId, methodCode, version, rules, sections, provenance, meta } = input;

  const missing: string[] = [];
  if (!rules.length) missing.push("rules");
  if (!sections.length) missing.push("sections");

  // For MVP, all questions require at least sections; some benefit from rules.
  if (questionId === "required_data" || questionId === "monitoring_reporting") {
    if (!sections.length) return buildMissingAnswer(questionId, ["sections"], provenance);
  } else if (questionId === "changes_vs_previous") {
    if (!meta) missing.push("meta");
    if (missing.length) return buildMissingAnswer(questionId, Array.from(new Set(missing)), provenance);
  } else {
    if (missing.length) return buildMissingAnswer(questionId, missing, provenance);
  }

  const assumptions: string[] = [
    "Generated from loaded section titles/snippets and rule titles/snippets only.",
    "This output does not infer requirements beyond loaded text.",
  ];

  const next_actions: string[] = [
    "Open the linked evidence items to validate details in context.",
    "Export the evidence bundle for audit packaging.",
  ];

  const sectionText = (s: SectionSummary) => `${s.id} ${s.title} ${s.textSnippet ?? ""}`;
  const ruleText = (r: RuleSummary) => `${r.id} ${r.title} ${r.snippet}`;

  const evidence: EvidenceItem[] = [];

  const addSectionEvidence = (matches: SectionSummary[]) => {
    for (const section of matches) {
      evidence.push({
        type: "section",
        id: section.id,
        title: section.title,
        href: hrefForSection(methodCode, version, section.id),
      });
    }
  };

  const addRuleEvidence = (matches: RuleSummary[]) => {
    for (const rule of matches) {
      evidence.push({
        type: "rule",
        id: rule.id,
        title: rule.title,
        href: hrefForRule(methodCode, version, rule.id),
      });
    }
  };

  const uniqEvidence = () => {
    const seen = new Set<string>();
    return evidence.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  if (questionId === "purpose_claims") {
    const sectionsFound =
      topMatches(sections, sectionText, ["purpose", "scope", "objective", "claim"], 3) ||
      sections.slice(0, 2);
    const rulesFound = topMatches(rules, ruleText, ["shall", "must", "objective", "scope"], 2);

    addSectionEvidence(sectionsFound.length ? sectionsFound : sections.slice(0, 2));
    addRuleEvidence(rulesFound);

    const answer_md = [
      "## Answer",
      "This methodology’s purpose and claims are grounded in the sections linked below.",
      "",
      "## Summary",
      `- Loaded sections: ${sections.length}`,
      `- Loaded rules: ${rules.length}`,
      "",
      "Use the Evidence chips to verify the exact language.",
    ].join("\n");

    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  if (questionId === "eligibility_constraints") {
    const sectionsFound = topMatches(sections, sectionText, ["eligib", "applic", "boundary", "project", "shall", "must"], 4);
    const rulesFound = topMatches(rules, ruleText, ["eligib", "shall", "must", "require"], 3);
    addSectionEvidence(sectionsFound);
    addRuleEvidence(rulesFound);

    const answer_md = [
      "## Answer",
      "Eligibility constraints should be validated from the linked passages; this summary avoids introducing unstated requirements.",
      "",
      "## What to look for",
      "- Applicability conditions (where the method can/can’t be used)",
      "- Boundary definitions and exclusions",
      "- Required prerequisites before claiming credits",
    ].join("\n");

    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  if (questionId === "required_data") {
    const sectionsFound = topMatches(sections, sectionText, ["data", "parameter", "input", "table", "measure", "monitor"], 5);
    addSectionEvidence(sectionsFound.length ? sectionsFound : sections.slice(0, 3));

    const answer_md = [
      "## Answer",
      "Required data inputs are defined in the linked sections (parameters, tables, and monitoring inputs).",
      "",
      "## How to use this",
      "- Extract parameter names, units, and sources from the Evidence sections",
      "- Confirm any default values or conservative assumptions in the source text",
    ].join("\n");

    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  if (questionId === "calculation_steps") {
    const sectionsFound = topMatches(sections, sectionText, ["calcul", "equation", "step", "formula", "baseline", "emission"], 5);
    const rulesFound = topMatches(rules, ruleText, ["calcul", "equation", "baseline", "emission"], 3);
    addSectionEvidence(sectionsFound.length ? sectionsFound : sections.slice(0, 3));
    addRuleEvidence(rulesFound);

    const answer_md = [
      "## Answer",
      "Calculation steps are grounded in the linked sections (and any rules that reference formulas/steps).",
      "",
      "## Suggested walkthrough",
      "- Identify the baseline scenario section(s)",
      "- Locate equations/formulas and required parameters",
      "- Confirm any discounting / uncertainty / conservativeness rules",
    ].join("\n");

    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  if (questionId === "monitoring_reporting") {
    const sectionsFound = topMatches(sections, sectionText, ["monitor", "report", "qa", "qc", "verification", "frequency"], 5);
    addSectionEvidence(sectionsFound.length ? sectionsFound : sections.slice(0, 3));

    const answer_md = [
      "## Answer",
      "Monitoring and reporting expectations are defined in the linked sections.",
      "",
      "## What to extract",
      "- Required measurements and frequency",
      "- QA/QC procedures",
      "- Reporting artifacts and retention requirements",
    ].join("\n");

    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  if (questionId === "changes_vs_previous") {
    const sectionsFound = topMatches(sections, sectionText, ["change", "revision", "update", "previous"], 4);
    addSectionEvidence(sectionsFound);
    const answer_md = [
      "## Answer",
      "Changes vs previous versions should be confirmed directly in the linked sections and any referenced change logs.",
      "",
      "If no change-log section is present, open the Versions tab to compare versions manually.",
    ].join("\n");
    return { question_id: questionId, answer_md, evidence: uniqEvidence(), assumptions, next_actions, provenance };
  }

  const fallback_md = `Not enough evidence loaded.\n\nMissing: rules, sections`;
  return { question_id: questionId, answer_md: fallback_md, evidence: [], assumptions: [], next_actions: [], provenance };
}
