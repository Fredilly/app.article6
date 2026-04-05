import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { getAttachmentBytes } from "@/lib/proofMap/attachments";
import type { EvidenceAttachment, PddFragment, WorkbookEvidenceAsset, WorkbookRecordGroup } from "@/lib/proofMap/types";

export type QuickCheckEvidenceFactCategory =
  | "boundary"
  | "monitoring-plan"
  | "workbook-reference"
  | "monitoring-evidence"
  | "plot-count"
  | "reporting-period"
  | "monitoring-records"
  | "qa-summary";

export type QuickCheckEvidenceFact = {
  id: string;
  category: QuickCheckEvidenceFactCategory;
  summary: string;
  matchText: string;
  sourceLabel: string;
  detail?: string;
};

export type QuickCheckEvidenceAnalysis = {
  facts: QuickCheckEvidenceFact[];
  parsedEvidenceLabels: string[];
};

type QuickCheckEvidenceSource = {
  evidenceId: string;
  sourceLabel: string;
  attachments: EvidenceAttachment[];
  pddFragments?: PddFragment[];
  inventoryItem?: EvidenceInventoryItem;
};

type ResolveAttachmentBytes = (attachmentId: string) => Promise<ArrayBuffer | null>;

type QuickCheckRuleLike = {
  id: string;
  title: string;
  snippet: string;
  summary?: string;
  logic?: string;
  notes?: string;
  when?: string[];
  expectedEvidence?: string[];
  tags?: string[];
};

export type QuickCheckLocalRuleCandidate = {
  requirementId: string;
  requirementLabel: string;
  score: number;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "have",
  "has",
  "one",
  "item",
  "evidence",
  "claim",
  "project",
  "documented",
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function asLower(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function stableFactId(input: { sourceLabel: string; category: QuickCheckEvidenceFactCategory; summary: string }): string {
  return `${input.sourceLabel}:${input.category}:${input.summary}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-");
}

function addFact(
  next: Map<string, QuickCheckEvidenceFact>,
  input: Omit<QuickCheckEvidenceFact, "id">,
): void {
  const summary = normalizeWhitespace(input.summary);
  if (!summary) return;
  const key = `${input.category}::${summary.toLowerCase()}`;
  if (next.has(key)) return;
  next.set(key, {
    ...input,
    summary,
    matchText: normalizeWhitespace(input.matchText),
    id: stableFactId({ sourceLabel: input.sourceLabel, category: input.category, summary }),
  });
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      if (escaped === "n") return " ";
      if (escaped === "r") return " ";
      if (escaped === "t") return " ";
      if (escaped === "b") return " ";
      if (escaped === "f") return " ";
      return escaped;
    })
    .replace(/\\\d{1,3}/g, " ")
    .replace(/\\\r?\n/g, "");
}

function extractPdfLiteralStrings(raw: string): string[] {
  const next: string[] = [];
  let buffer = "";
  let depth = 0;
  let escaping = false;

  for (const char of raw) {
    if (depth > 0) {
      buffer += char;
    }
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === "(") {
      if (depth === 0) buffer = "";
      depth += 1;
      continue;
    }
    if (char === ")" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        const decoded = normalizeWhitespace(decodePdfLiteral(buffer.slice(0, -1)));
        if (decoded.length >= 8) next.push(decoded);
        buffer = "";
      }
    }
  }

  return next;
}

function extractPrintableSequences(raw: string): string[] {
  return Array.from(
    new Set(
      (raw.match(/[A-Za-z][A-Za-z0-9,.;:()/_ \-\n]{20,}/g) ?? [])
        .map((entry) => normalizeWhitespace(entry))
        .filter((entry) => entry.length >= 16),
    ),
  );
}

function extractPdfText(bytes: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(new Uint8Array(bytes));
  const segments = [...extractPdfLiteralStrings(raw), ...extractPrintableSequences(raw)];
  return normalizeWhitespace(Array.from(new Set(segments)).join(" "));
}

function derivePdfFactsFromText(text: string, sourceLabel: string): QuickCheckEvidenceFact[] {
  const haystack = asLower(text);
  const next = new Map<string, QuickCheckEvidenceFact>();

  if (/(project boundary|boundary description|grouped activity boundary|boundary covers|eligibility boundary)/.test(haystack)) {
    addFact(next, {
      category: "boundary",
      summary: "The project boundary is described in the PDD",
      matchText: "project boundary described",
      sourceLabel,
    });
  }

  if (/(monitoring plan|monitoring procedures|monitoring approach|plan for monitoring)/.test(haystack)) {
    addFact(next, {
      category: "monitoring-plan",
      summary: "The project has a documented monitoring plan",
      matchText: "documented monitoring plan",
      sourceLabel,
    });
  }

  if (/(workbook|spreadsheet|excel)/.test(haystack)) {
    addFact(next, {
      category: "workbook-reference",
      summary: "The workbook is referenced in the PDD",
      matchText: "workbook referenced in pdd",
      sourceLabel,
    });
  }

  if (/(monitoring plan|monitoring report|monitoring records|monitoring data|monitoring procedures)/.test(haystack)) {
    addFact(next, {
      category: "monitoring-evidence",
      summary: "The project has documented monitoring evidence",
      matchText: "documented monitoring evidence",
      sourceLabel,
    });
  }

  return Array.from(next.values());
}

function derivePddFragmentFacts(fragments: PddFragment[], sourceLabel: string): QuickCheckEvidenceFact[] {
  const next = new Map<string, QuickCheckEvidenceFact>();
  for (const fragment of fragments) {
    const text = [fragment.label, fragment.section_label, fragment.section_heading, fragment.excerpt].filter(Boolean).join(" ");
    for (const fact of derivePdfFactsFromText(text, sourceLabel)) {
      addFact(next, fact);
    }
  }
  return Array.from(next.values());
}

function firstMatchingValue(group: WorkbookRecordGroup, pattern: RegExp): string | null {
  for (const row of group.rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!pattern.test(key)) continue;
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function uniqueMatchingValues(group: WorkbookRecordGroup, pattern: RegExp): string[] {
  const next = new Set<string>();
  for (const row of group.rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!pattern.test(key)) continue;
      const trimmed = value.trim();
      if (trimmed) next.add(trimmed);
    }
  }
  return Array.from(next).sort((a, b) => a.localeCompare(b));
}

function deriveWorkbookFactsFromAsset(asset: WorkbookEvidenceAsset, sourceLabel: string): QuickCheckEvidenceFact[] {
  const next = new Map<string, QuickCheckEvidenceFact>();

  for (const group of asset.record_groups) {
    if (group.group_type === "sampling_log" || group.group_type === "activity_data_table" || group.group_type === "monitoring_period_table") {
      addFact(next, {
        category: "monitoring-records",
        summary: "The workbook contains monitoring records",
        matchText: "workbook monitoring records",
        sourceLabel,
      });
    }

    const plotValues = uniqueMatchingValues(group, /(plot|sample(_id)?|transect)/i);
    if (plotValues.length) {
      addFact(next, {
        category: "plot-count",
        summary: `Monitoring data exists for ${plotValues.length} ${plotValues.length === 1 ? "plot" : "plots"}`,
        matchText: `monitoring data ${plotValues.length} plots`,
        sourceLabel,
        detail: plotValues.slice(0, 5).join(", "),
      });
    }

    const period = firstMatchingValue(group, /(monitoring_period|reporting_period|period_start|period_end|quarter|q[1-4])/i);
    if (period) {
      addFact(next, {
        category: "reporting-period",
        summary: `The workbook contains ${period} monitoring records`,
        matchText: `${period} monitoring records`,
        sourceLabel,
      });
    }

    const qaValue = firstMatchingValue(group, /(qa|quality|review|checked|status)/i);
    if (qaValue || /(qa|quality|review)/i.test(`${group.display_name} ${group.source_sheet} ${group.column_names.join(" ")}`)) {
      addFact(next, {
        category: "qa-summary",
        summary: "The workbook includes QA summary evidence",
        matchText: "qa summary workbook evidence",
        sourceLabel,
        detail: qaValue ?? undefined,
      });
    }
  }

  return Array.from(next.values());
}

export async function analyzeQuickCheckEvidence(
  sources: QuickCheckEvidenceSource[],
  options?: { resolveAttachmentBytes?: ResolveAttachmentBytes },
): Promise<QuickCheckEvidenceAnalysis> {
  const facts = new Map<string, QuickCheckEvidenceFact>();
  const parsedEvidenceLabels = new Set<string>();
  const resolveAttachmentBytes = options?.resolveAttachmentBytes ?? getAttachmentBytes;

  for (const source of sources) {
    if (source.pddFragments?.length) {
      parsedEvidenceLabels.add(source.sourceLabel);
      for (const fact of derivePddFragmentFacts(source.pddFragments, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }

    const workbookAssets = source.attachments.map((attachment) => attachment.workbook_asset).filter(Boolean) as WorkbookEvidenceAsset[];
    for (const asset of workbookAssets) {
      parsedEvidenceLabels.add(source.sourceLabel);
      for (const fact of deriveWorkbookFactsFromAsset(asset, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }

    for (const attachment of source.attachments) {
      if (attachment.mime !== "application/pdf") continue;
      const bytes = await resolveAttachmentBytes(attachment.id).catch(() => null);
      if (!bytes) continue;
      const text = extractPdfText(bytes);
      if (!text) continue;
      parsedEvidenceLabels.add(source.sourceLabel);
      for (const fact of derivePdfFactsFromText(text, source.sourceLabel)) {
        addFact(facts, fact);
      }
    }
  }

  return {
    facts: Array.from(facts.values()),
    parsedEvidenceLabels: Array.from(parsedEvidenceLabels).sort((a, b) => a.localeCompare(b)),
  };
}

export function buildQuickCheckQueryTexts(claimText: string, facts: QuickCheckEvidenceFact[]): string[] {
  const next = new Set<string>();
  const claim = normalizeWhitespace(claimText);
  if (claim) next.add(claim);
  for (const fact of facts.slice(0, 4)) {
    if (fact.matchText) next.add(fact.matchText);
  }
  return Array.from(next);
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function scoreRuleAgainstFacts(rule: QuickCheckRuleLike, facts: QuickCheckEvidenceFact[]): number {
  const haystack = asLower(
    [
      rule.title,
      rule.snippet,
      rule.summary,
      rule.logic,
      rule.notes,
      ...(rule.when ?? []),
      ...(rule.expectedEvidence ?? []),
      ...(rule.tags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  let score = 0;

  for (const fact of facts) {
    if (fact.category === "boundary" && haystack.includes("boundary")) score += 1.25;
    if (fact.category === "monitoring-plan" && haystack.includes("monitoring") && (haystack.includes("plan") || haystack.includes("report"))) {
      score += 1.15;
    }
    if (fact.category === "workbook-reference" && (haystack.includes("workbook") || haystack.includes("spreadsheet"))) score += 0.9;
    if (fact.category === "monitoring-evidence" && haystack.includes("monitoring")) score += 0.8;
    if (fact.category === "plot-count" && (haystack.includes("plot") || haystack.includes("sampling") || haystack.includes("monitoring"))) score += 1;
    if (fact.category === "reporting-period" && (haystack.includes("period") || haystack.includes("monitoring"))) score += 1;
    if (fact.category === "monitoring-records" && (haystack.includes("monitoring") || haystack.includes("workbook"))) score += 0.85;
    if (fact.category === "qa-summary" && (haystack.includes("qa") || haystack.includes("quality") || haystack.includes("review"))) score += 0.8;
  }

  return score;
}

export function buildLocalRuleCandidates(input: {
  claimText: string;
  facts: QuickCheckEvidenceFact[];
  rules: QuickCheckRuleLike[];
}): QuickCheckLocalRuleCandidate[] {
  const claimKeywords = tokenize(input.claimText);

  return input.rules
    .map((rule) => {
      const haystack = asLower(
        [
          rule.id,
          rule.title,
          rule.snippet,
          rule.summary,
          rule.logic,
          rule.notes,
          ...(rule.when ?? []),
          ...(rule.expectedEvidence ?? []),
          ...(rule.tags ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      );
      let score = scoreRuleAgainstFacts(rule, input.facts);
      for (const keyword of claimKeywords) {
        if (haystack.includes(keyword)) score += keyword.length >= 7 ? 0.45 : 0.25;
      }
      return {
        requirementId: rule.id,
        requirementLabel: `${rule.id} · ${rule.title}`,
        score,
      };
    })
    .filter((candidate) => candidate.score >= 1.2)
    .sort((a, b) => b.score - a.score || a.requirementLabel.localeCompare(b.requirementLabel))
    .slice(0, 4);
}
