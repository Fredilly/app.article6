import type { AssistantQuestionId } from "@/lib/assistant/questions";

export type PromptCategory =
  | "eligibility"
  | "additionality"
  | "monitoring"
  | "leakage"
  | "permanence";

export const WHERE_DEFINED_CATEGORIES: { id: PromptCategory; label: string }[] = [
  { id: "eligibility", label: "Eligibility" },
  { id: "additionality", label: "Additionality" },
  { id: "monitoring", label: "Monitoring" },
  { id: "leakage", label: "Leakage" },
  { id: "permanence", label: "Permanence" },
];

type RuleInput = { id: string; title: string; snippet: string; tags?: string[]; text?: string };
type SectionInput = { id: string; title: string; textSnippet?: string; text?: string };

type EvidenceItem = { type: "rule" | "section"; id: string; title?: string };

export type AssistantAnswer = {
  question_id: AssistantQuestionId;
  answer: string;
  evidence: EvidenceItem[];
  assumptions?: string[];
  next_actions: Array<{ id: "open_verify" | "add_evidence" | "export_pack"; label: string }>;
  provenance: { pack?: string; generated_at?: string; repo_sha?: string };
};

const CATEGORY_KEYWORDS: Record<PromptCategory, string[]> = {
  eligibility: ["eligib", "applic", "boundary", "project", "scope"],
  additionality: ["additional", "baseline", "barrier", "common practice"],
  monitoring: ["monitor", "report", "qa", "qc", "verification", "frequency"],
  leakage: ["leak", "leakage", "displacement", "reversal"],
  permanence: ["perman", "reversal", "buffer", "risk", "crediting period"],
};

const IMPORTANT_RULE_KEYWORDS = [
  "mrv",
  "monitor",
  "report",
  "eligib",
  "additional",
  "leak",
  "perman",
  "baseline",
  "verification",
  "audit",
];

const EVIDENCE_KEYWORDS = ["data", "parameter", "input", "evidence", "record", "monitor", "report", "qa", "qc"];

function scoreByKeywords(text: string, keywords: string[]): number {
  return keywords.reduce((score, kw) => (text.includes(kw) ? score + 1 : score), 0);
}

function pickTop<T>(items: T[], toText: (item: T) => string, keywords: string[], limit: number): T[] {
  const scored = items
    .map((item) => ({ item, score: scoreByKeywords(toText(item), keywords) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((row) => row.item);
}

function ruleText(rule: RuleInput): string {
  return [
    rule.id,
    rule.title,
    rule.snippet,
    rule.text ?? "",
    ...(rule.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sectionText(section: SectionInput): string {
  return [section.id, section.title, section.textSnippet ?? "", section.text ?? ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureEvidence(items: EvidenceItem[], rules: RuleInput[], sections: SectionInput[]): EvidenceItem[] {
  const evidence = [...items];
  const rulesUsed = new Set(evidence.filter((item) => item.type === "rule").map((item) => item.id));
  const sectionsUsed = new Set(evidence.filter((item) => item.type === "section").map((item) => item.id));

  const addRule = (rule?: RuleInput) => {
    if (!rule || rulesUsed.has(rule.id)) return;
    rulesUsed.add(rule.id);
    evidence.push({ type: "rule", id: rule.id, title: rule.title });
  };

  const addSection = (section?: SectionInput) => {
    if (!section || sectionsUsed.has(section.id)) return;
    sectionsUsed.add(section.id);
    evidence.push({ type: "section", id: section.id, title: section.title });
  };

  if (rulesUsed.size === 0 && rules.length) addRule(rules[0]);
  if (sectionsUsed.size === 0 && sections.length) addSection(sections[0]);

  if (rulesUsed.size >= 2 || (rulesUsed.size >= 1 && sectionsUsed.size >= 1)) {
    return dedupeEvidence(evidence);
  }

  if (rules.length > 1 && rulesUsed.size < 2) addRule(rules[1]);
  if (sections.length > 1 && sectionsUsed.size < 1) addSection(sections[1]);

  return dedupeEvidence(evidence);
}

function baseActions(): AssistantAnswer["next_actions"] {
  return [
    { id: "open_verify", label: "Open Verify" },
    { id: "add_evidence", label: "Add evidence" },
    { id: "export_pack", label: "Export pack" },
  ];
}

export function generateAnswer(input: {
  questionId: AssistantQuestionId;
  methodCode: string;
  version: string;
  rules: RuleInput[];
  sections: SectionInput[];
  category?: PromptCategory;
  provenance: { pack?: string; generated_at?: string; repo_sha?: string };
}): AssistantAnswer {
  const { questionId, rules, sections, category = "eligibility", provenance } = input;

  const evidence: EvidenceItem[] = [];
  const addRules = (items: RuleInput[]) => {
    for (const rule of items) {
      evidence.push({ type: "rule", id: rule.id, title: rule.title });
    }
  };
  const addSections = (items: SectionInput[]) => {
    for (const section of items) {
      evidence.push({ type: "section", id: section.id, title: section.title });
    }
  };

  if (questionId === "important_rules") {
    const rulesFound = pickTop(rules, ruleText, IMPORTANT_RULE_KEYWORDS, 4);
    const sectionsFound = pickTop(sections, sectionText, IMPORTANT_RULE_KEYWORDS, 2);
    addRules(rulesFound.length ? rulesFound : rules.slice(0, 3));
    addSections(sectionsFound);

    const answer =
      "Start with the rules below that shape eligibility, monitoring, and permanence. Verify each against the cited sections.";

    return {
      question_id: questionId,
      answer,
      evidence: ensureEvidence(dedupeEvidence(evidence), rules, sections),
      assumptions: ["Priority is inferred from tags and keyword matches."],
      next_actions: baseActions(),
      provenance,
    };
  }

  if (questionId === "evidence_first") {
    const sectionsFound = pickTop(sections, sectionText, EVIDENCE_KEYWORDS, 4);
    const rulesFound = pickTop(rules, ruleText, EVIDENCE_KEYWORDS, 2);
    addSections(sectionsFound.length ? sectionsFound : sections.slice(0, 3));
    addRules(rulesFound);

    const answer =
      "Gather monitoring inputs, eligibility evidence, and any permanence/leakage controls referenced below.";

    return {
      question_id: questionId,
      answer,
      evidence: ensureEvidence(dedupeEvidence(evidence), rules, sections),
      assumptions: ["Checklist is inferred from rule tags and section keywords."],
      next_actions: baseActions(),
      provenance,
    };
  }

  if (questionId === "where_defined") {
    const keywords = CATEGORY_KEYWORDS[category];
    const sectionsFound = pickTop(sections, sectionText, keywords, 4);
    const rulesFound = pickTop(rules, ruleText, keywords, 2);
    addSections(sectionsFound.length ? sectionsFound : sections.slice(0, 2));
    addRules(rulesFound);

    const label = WHERE_DEFINED_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Category";
    const answer = `The ${label.toLowerCase()} definition and constraints are grounded in the sections below.`;

    return {
      question_id: questionId,
      answer,
      evidence: ensureEvidence(dedupeEvidence(evidence), rules, sections),
      next_actions: baseActions(),
      provenance,
    };
  }

  const exportKeywords = ["audit", "export", "pack", "verification", "report"];
  const rulesFound = pickTop(rules, ruleText, exportKeywords, 2);
  const sectionsFound = pickTop(sections, sectionText, exportKeywords, 2);
  addRules(rulesFound.length ? rulesFound : rules.slice(0, 1));
  addSections(sectionsFound.length ? sectionsFound : sections.slice(0, 1));

  const answer = "Use the Export pack action to generate the audit-ready bundle for this method and version.";

  return {
    question_id: questionId,
    answer,
    evidence: ensureEvidence(dedupeEvidence(evidence), rules, sections),
    next_actions: baseActions(),
    provenance,
  };
}
