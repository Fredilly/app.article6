export type QuickCheckDocumentClass =
  | "project_description_pdd"
  | "monitoring_report"
  | "validation_report"
  | "verification_report"
  | "validation_verification_report"
  | "methodology_document"
  | "risk_report"
  | "supporting_evidence_file"
  | "registry_or_public_record"
  | "unknown_carbon_document"
  | "non_carbon_document";

export type QuickCheckDocumentCandidate = {
  documentClass: QuickCheckDocumentClass;
  confidence: number;
  evidence: string[];
};

export type QuickCheckDocumentClassification = {
  documentClass: QuickCheckDocumentClass;
  confidence: number;
  evidence: string[];
  secondaryCandidates: QuickCheckDocumentCandidate[];
  warnings: string[];
};

type QuickCheckDocumentClassifierInput = {
  fileName?: string | null;
  mime?: string | null;
  rawText?: string | null;
};

type RuleClass = Exclude<QuickCheckDocumentClass, "unknown_carbon_document">;

type ScoreEntry = {
  score: number;
  evidence: string[];
};

type WeightedPattern = {
  pattern: RegExp;
  weight: number;
  source: "filename" | "title_block" | "header" | "repeated_header" | "toc" | "table" | "body" | "mime";
};

type ClassPhraseDefinition = {
  documentClass: RuleClass;
  pattern: RegExp;
  repeatedPattern?: RegExp;
  allowSectionContext?: boolean;
};

const DOCUMENT_CLASS_ORDER: QuickCheckDocumentClass[] = [
  "validation_verification_report",
  "verification_report",
  "validation_report",
  "monitoring_report",
  "project_description_pdd",
  "methodology_document",
  "risk_report",
  "supporting_evidence_file",
  "registry_or_public_record",
  "non_carbon_document",
  "unknown_carbon_document",
];

const TOP_LINE_COUNT = 30;
const TOP_TABLE_LIMIT = 3;
const TOC_LINE_LIMIT = 60;
const DIRECT_SIGNAL_WINDOW = 1600;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactLines(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function labelForSource(source: WeightedPattern["source"]): string {
  switch (source) {
    case "filename":
      return "filename";
    case "title_block":
      return "page 1 title";
    case "header":
      return "page 1 header";
    case "repeated_header":
      return "repeated header";
    case "toc":
      return "table of contents";
    case "table":
      return "top table";
    case "mime":
      return "media type";
    default:
      return "body";
  }
}

function scoreFor(entries: Map<RuleClass, ScoreEntry>, documentClass: RuleClass): ScoreEntry {
  const existing = entries.get(documentClass);
  if (existing) return existing;
  const created: ScoreEntry = { score: 0, evidence: [] };
  entries.set(documentClass, created);
  return created;
}

function addEvidence(entries: Map<RuleClass, ScoreEntry>, documentClass: RuleClass, weight: number, evidence: string): void {
  const entry = scoreFor(entries, documentClass);
  entry.score += weight;
  if (!entry.evidence.includes(evidence)) entry.evidence.push(evidence);
}

function applyPatterns(
  entries: Map<RuleClass, ScoreEntry>,
  documentClass: RuleClass,
  haystack: string,
  patterns: WeightedPattern[],
): void {
  for (const rule of patterns) {
    const match = rule.pattern.exec(haystack);
    rule.pattern.lastIndex = 0;
    if (!match) continue;
    addEvidence(entries, documentClass, rule.weight, `${labelForSource(rule.source)}: "${normalizeWhitespace(match[0])}"`);
  }
}

function buildRepeatedHeaders(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!normalized || normalized.length < 12) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([line]) => line);
}

function isPageNumberOrVersionLine(line: string): boolean {
  return /^v?\d+(\.\d+)?$/i.test(line)
    || /^page\s+\d+$/i.test(line)
    || /^\d+$/.test(line)
    || /^\d+\s+of\s+\d+$/i.test(line);
}

function isMetadataNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (isPageNumberOrVersionLine(line)) return true;
  if (line.length <= 2) return true;
  return /\b(phone|fax|email|contact|address|website|www\.|prepared by|approved by|work carried out by|client|pages|date of issue|report id|version)\b/.test(lower);
}

function looksLikeTitleSignal(line: string): boolean {
  const lower = line.toLowerCase();
  if (/\b(project description|project design document|project document|validation report|verification report|monitoring report|methodology|risk report)\b/.test(lower)) {
    return true;
  }
  const alphaChars = line.replace(/[^A-Za-z]/g, "");
  if (alphaChars.length < 6) return false;
  const uppercaseChars = line.replace(/[^A-Z]/g, "").length;
  return uppercaseChars / alphaChars.length >= 0.72;
}

function buildTitleBlock(lines: string[], repeatedHeaders: string[]): string[] {
  const repeated = new Set(repeatedHeaders.map((line) => line.toLowerCase()));
  const titleLines: string[] = [];
  let sawStrongTitle = false;

  for (const line of lines.slice(0, 24)) {
    const lower = line.toLowerCase();
    if (repeated.has(lower)) continue;
    if (isMetadataNoiseLine(line) && !sawStrongTitle) continue;
    if (isMetadataNoiseLine(line) && titleLines.length >= 2) break;
    if (!looksLikeTitleSignal(line) && !sawStrongTitle && titleLines.length === 0) continue;

    if (looksLikeTitleSignal(line)) sawStrongTitle = true;
    titleLines.push(line);

    if (titleLines.length >= 5) break;
  }

  if (titleLines.length > 0) return titleLines;

  return lines
    .slice(0, 8)
    .filter((line) => !repeated.has(line.toLowerCase()) && !isMetadataNoiseLine(line))
    .slice(0, 3);
}

function isTableLikeLine(line: string): boolean {
  return /\|/.test(line) || /\t/.test(line) || /\s{2,}[A-Za-z0-9(]/.test(line);
}

function buildTopTables(lines: string[]): string[] {
  const tables: string[] = [];
  let current: string[] = [];

  for (const line of lines.slice(0, 220)) {
    if (isTableLikeLine(line)) {
      current.push(line);
      continue;
    }
    if (current.length >= 2) {
      tables.push(current.slice(0, 3).join(" "));
      if (tables.length >= TOP_TABLE_LIMIT) break;
    }
    current = [];
  }
  if (tables.length < TOP_TABLE_LIMIT && current.length >= 2) {
    tables.push(current.slice(0, 3).join(" "));
  }
  return tables;
}

function buildTocLines(lines: string[]): string[] {
  const topLines = lines.slice(0, TOC_LINE_LIMIT);
  const hasTocHeader = topLines.some((line) => /\btable of contents\b|\bcontents\b/i.test(line));
  if (!hasTocHeader) return [];

  return topLines.filter((line) =>
    /^(\d+(\.\d+)*|\b[a-z]\)|\bsection\b|\bappendix\b)/i.test(line)
    || /\.{2,}\s*\d+$/.test(line)
  );
}

function isSectionContext(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 28), index);
  return /\d+(?:\.\d+)*\s*$/.test(prefix)
    || /\btable\s*of\s*contents\b|\bcontents\b/i.test(prefix);
}

function addDirectPhraseSignals(
  entries: Map<RuleClass, ScoreEntry>,
  rawText: string,
  definitions: ClassPhraseDefinition[],
): void {
  const leadingWindow = rawText.slice(0, DIRECT_SIGNAL_WINDOW);

  for (const definition of definitions) {
    const leadingMatch = definition.pattern.exec(leadingWindow);
    definition.pattern.lastIndex = 0;
    if (leadingMatch && typeof leadingMatch.index === "number") {
      const inSectionContext = isSectionContext(leadingWindow, leadingMatch.index);
      if (!inSectionContext || definition.allowSectionContext) {
        const weight = leadingMatch.index <= 320 ? 2.7 : leadingMatch.index <= 900 ? 2.1 : 1.5;
        addEvidence(entries, definition.documentClass, weight, `page 1 title: "${normalizeWhitespace(leadingMatch[0])}"`);
      }
    }

    const repeatedPattern = definition.repeatedPattern ?? definition.pattern;
    const repeatedMatches = Array.from(rawText.matchAll(new RegExp(repeatedPattern.source, repeatedPattern.flags.includes("g") ? repeatedPattern.flags : `${repeatedPattern.flags}g`)))
      .filter((match) => typeof match.index === "number" && (!isSectionContext(rawText, match.index!) || definition.allowSectionContext));
    if (repeatedMatches.length >= 2) {
      addEvidence(
        entries,
        definition.documentClass,
        Math.min(2.4, 0.8 + repeatedMatches.length * 0.45),
        `repeated header: "${normalizeWhitespace(repeatedMatches[0]?.[0] ?? "")}"`,
      );
    }
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (index >= 0) {
    index = haystack.indexOf(needle, index);
    if (index < 0) break;
    count += 1;
    index += needle.length;
  }
  return count;
}

function addCompactedTitleSignals(entries: Map<RuleClass, ScoreEntry>, rawText: string): void {
  const compactLeading = rawText.slice(0, DIRECT_SIGNAL_WINDOW).toLowerCase().replace(/\s+/g, "");
  const compactFull = rawText.toLowerCase().replace(/\s+/g, "");
  const compactDefinitions: Array<{ documentClass: RuleClass; token: string }> = [
    { documentClass: "validation_verification_report", token: "validationandverificationreport" },
    { documentClass: "validation_verification_report", token: "verificationandvalidationreport" },
    { documentClass: "verification_report", token: "verificationreport" },
    { documentClass: "validation_report", token: "validationreport" },
    { documentClass: "monitoring_report", token: "monitoringreport" },
    { documentClass: "project_description_pdd", token: "projectdescriptiondocument" },
    { documentClass: "project_description_pdd", token: "projectdescription" },
    { documentClass: "project_description_pdd", token: "projectdesigndocument" },
    { documentClass: "methodology_document", token: "methodologydocument" },
    { documentClass: "risk_report", token: "non-permanenceriskreport" },
    { documentClass: "risk_report", token: "nonpermanenceriskreport" },
  ];

  for (const definition of compactDefinitions) {
    const leadingIndex = compactLeading.indexOf(definition.token);
    if (leadingIndex >= 0) {
      addEvidence(
        entries,
        definition.documentClass,
        leadingIndex <= 220 ? 2.8 : 2.0,
        `page 1 title: "${definition.token.toUpperCase()}"`,
      );
    }
    const occurrences = countOccurrences(compactFull, definition.token);
    if (occurrences >= 2) {
      addEvidence(
        entries,
        definition.documentClass,
        Math.min(2.6, 0.9 + occurrences * 0.45),
        `repeated header: "${definition.token.toUpperCase()}"`,
      );
    }
  }
}

function clampConfidence(value: number): number {
  return Number(Math.max(0.05, Math.min(0.99, value)).toFixed(3));
}

function deriveConfidence(bestScore: number, secondScore: number, evidenceCount: number): number {
  const margin = Math.max(0, bestScore - secondScore);
  return clampConfidence(0.3 + bestScore * 0.12 + margin * 0.08 + Math.min(0.12, evidenceCount * 0.015));
}

function buildWarnings(bestScore: number, secondScore: number, evidenceCount: number, rawText: string): string[] {
  const warnings: string[] = [];
  if (!rawText.trim()) warnings.push("No extracted document text was available; classification relied on filename and media type only.");
  if (bestScore < 1.2) warnings.push("Classification confidence is limited because deterministic signals were sparse.");
  if (bestScore - secondScore < 0.45 && secondScore > 0.4) warnings.push("Multiple document classes had similar signal strength.");
  if (evidenceCount === 0) warnings.push("No positive classification signals were captured.");
  return warnings;
}

const FILENAME_RULES: Array<{ documentClass: RuleClass; patterns: WeightedPattern[] }> = [
  {
    documentClass: "validation_verification_report",
    patterns: [
      { pattern: /validation[-_ ]?(?:and|&)[-_ ]?verification[-_ ]?report/i, weight: 1.8, source: "filename" },
      { pattern: /verification[-_ ]?(?:and|&)[-_ ]?validation[-_ ]?report/i, weight: 1.8, source: "filename" },
    ],
  },
  {
    documentClass: "verification_report",
    patterns: [
      { pattern: /\bverification[-_ ]?report\b/i, weight: 1.45, source: "filename" },
      { pattern: /\bvvb[-_ ]?verification\b/i, weight: 1.2, source: "filename" },
    ],
  },
  {
    documentClass: "validation_report",
    patterns: [
      { pattern: /\bvalidation[-_ ]?report\b/i, weight: 1.45, source: "filename" },
      { pattern: /\bvalid[_-]?rep\b/i, weight: 1.2, source: "filename" },
    ],
  },
  {
    documentClass: "monitoring_report",
    patterns: [
      { pattern: /\bmonitoring[-_ ]?report\b/i, weight: 1.4, source: "filename" },
      { pattern: /\breporting[-_ ]?period\b/i, weight: 0.9, source: "filename" },
    ],
  },
  {
    documentClass: "project_description_pdd",
    patterns: [
      { pattern: /\bproj(?:ect)?[-_ ]?desc(?:ription)?\b/i, weight: 1.5, source: "filename" },
      { pattern: /\bpd[_-]?redd\b/i, weight: 1.45, source: "filename" },
      { pattern: /\bpdd\b/i, weight: 1.15, source: "filename" },
    ],
  },
  {
    documentClass: "methodology_document",
    patterns: [
      { pattern: /\bmethodolog(?:y|ical)\b/i, weight: 1.45, source: "filename" },
      { pattern: /\btool\b/i, weight: 0.8, source: "filename" },
    ],
  },
  {
    documentClass: "risk_report",
    patterns: [
      { pattern: /\brisk[-_ ]?(?:report|assessment|analysis)\b/i, weight: 1.45, source: "filename" },
      { pattern: /\bnon[-_ ]?permanence\b/i, weight: 1.3, source: "filename" },
    ],
  },
  {
    documentClass: "supporting_evidence_file",
    patterns: [
      { pattern: /\bappendix\b|\bannex\b|\battachment\b/i, weight: 1.1, source: "filename" },
      { pattern: /\bsupporting[-_ ]?(?:evidence|document|file)\b/i, weight: 1.25, source: "filename" },
    ],
  },
  {
    documentClass: "registry_or_public_record",
    patterns: [
      { pattern: /\bregistry\b|\bpublic[-_ ]record\b|\bgazette\b|\bcadastral\b/i, weight: 1.4, source: "filename" },
    ],
  },
  {
    documentClass: "non_carbon_document",
    patterns: [
      { pattern: /\binvoice\b|\bresume\b|\bproposal\b|\bdeck\b|\bminutes\b|\bcontract\b/i, weight: 1.6, source: "filename" },
    ],
  },
];

const HEADER_RULES: Array<{ documentClass: RuleClass; patterns: WeightedPattern[] }> = [
  {
    documentClass: "validation_verification_report",
    patterns: [
      { pattern: /\bvalidation\s*(?:and|&|\/)\s*verification\s+report\b/i, weight: 2.3, source: "header" },
      { pattern: /\bverification\s*(?:and|&|\/)\s*validation\s+report\b/i, weight: 2.3, source: "header" },
    ],
  },
  {
    documentClass: "verification_report",
    patterns: [
      { pattern: /\bverification report\b/i, weight: 2.0, source: "header" },
      { pattern: /\bverified carbon standard\b/i, weight: 0.8, source: "header" },
      { pattern: /\bvalidation report\b/i, weight: -0.9, source: "header" },
    ],
  },
  {
    documentClass: "validation_report",
    patterns: [
      { pattern: /\bvalidation report\b/i, weight: 2.0, source: "header" },
      { pattern: /\bverification report\b/i, weight: -0.9, source: "header" },
    ],
  },
  {
    documentClass: "monitoring_report",
    patterns: [
      { pattern: /\bmonitoring report\b/i, weight: 2.0, source: "header" },
      { pattern: /\bmonitoring period report\b/i, weight: 1.6, source: "header" },
    ],
  },
  {
    documentClass: "project_description_pdd",
    patterns: [
      { pattern: /\bproject description(?: document)?\b/i, weight: 1.95, source: "header" },
      { pattern: /\bproject design document\b/i, weight: 1.95, source: "header" },
      { pattern: /\bproject document\b/i, weight: 1.35, source: "header" },
      { pattern: /\bccb\s*&\s*vcs\s+project description\b/i, weight: 2.2, source: "header" },
      { pattern: /\bproject description\s*\/\s*pd\b/i, weight: 1.8, source: "header" },
    ],
  },
  {
    documentClass: "methodology_document",
    patterns: [
      { pattern: /\bmethodology (?:document|framework|tool|module)\b/i, weight: 1.95, source: "header" },
      { pattern: /\bapproved consolidated methodology\b/i, weight: 1.8, source: "header" },
    ],
  },
  {
    documentClass: "risk_report",
    patterns: [
      { pattern: /\bnon[- ]?permanence risk report\b/i, weight: 2.1, source: "header" },
      { pattern: /\brisk (?:report|rating|analysis|assessment)\b/i, weight: 1.75, source: "header" },
    ],
  },
  {
    documentClass: "supporting_evidence_file",
    patterns: [
      { pattern: /\bappendix\b|\bannex\b|\battachment\b/i, weight: 1.0, source: "header" },
      { pattern: /\bsupporting documents?\b/i, weight: 1.2, source: "header" },
    ],
  },
  {
    documentClass: "registry_or_public_record",
    patterns: [
      { pattern: /\bnational registry\b|\bpublic registry\b|\bland registry\b|\bcertificate of title\b/i, weight: 1.95, source: "header" },
      { pattern: /\bgazette\b|\bcadastral\b|\bdeed\b|\bproperty register\b/i, weight: 1.5, source: "header" },
    ],
  },
  {
    documentClass: "non_carbon_document",
    patterns: [
      { pattern: /\binvoice\b|\bstatement of work\b|\bmaster services agreement\b|\bmeeting minutes\b/i, weight: 2.0, source: "header" },
    ],
  },
];

const BODY_RULES: Array<{ documentClass: RuleClass; patterns: WeightedPattern[] }> = [
  {
    documentClass: "verification_report",
    patterns: [
      { pattern: /\bverification opinion\b|\bverification statement\b|\baudit team evaluation\b/i, weight: 1.0, source: "body" },
      { pattern: /\bverification period\b/i, weight: 0.9, source: "body" },
    ],
  },
  {
    documentClass: "validation_report",
    patterns: [
      { pattern: /\bvalidation opinion\b|\bfinal validation report\b/i, weight: 1.0, source: "body" },
      { pattern: /\bvalidation process\b/i, weight: 0.8, source: "body" },
    ],
  },
  {
    documentClass: "monitoring_report",
    patterns: [
      { pattern: /\bmonitoring period of this report\b|\breporting period of this report\b/i, weight: 1.2, source: "body" },
      { pattern: /\breporting period\b|\bmonitoring period\b/i, weight: 0.85, source: "body" },
      { pattern: /\bmonitored data\b|\bmonitoring records\b/i, weight: 0.7, source: "body" },
    ],
  },
  {
    documentClass: "project_description_pdd",
    patterns: [
      { pattern: /\bwithout[- ]project scenario\b|\bbaseline scenario\b/i, weight: 0.55, source: "body" },
      { pattern: /\badditionality\b/i, weight: 0.35, source: "body" },
      { pattern: /\bapplication of methodology\b|\bproject boundary\b/i, weight: 0.45, source: "body" },
    ],
  },
  {
    documentClass: "methodology_document",
    patterns: [
      { pattern: /\bapplicability conditions\b|\bprocedure\b|\bmethodological tool\b/i, weight: 1.0, source: "body" },
    ],
  },
  {
    documentClass: "risk_report",
    patterns: [
      { pattern: /\bbuffer pool\b|\brisk rating\b|\brisk of non[- ]permanence\b/i, weight: 0.45, source: "body" },
    ],
  },
  {
    documentClass: "registry_or_public_record",
    patterns: [
      { pattern: /\bregistry entry\b|\bofficial notice\b|\bcertificate number\b|\bregistry number\b/i, weight: 0.95, source: "body" },
    ],
  },
  {
    documentClass: "non_carbon_document",
    patterns: [
      { pattern: /\baccounts payable\b|\bpayment terms\b|\bmarketing plan\b|\bcandidate experience\b/i, weight: 1.0, source: "body" },
    ],
  },
];

const CLASS_PHRASE_DEFINITIONS: ClassPhraseDefinition[] = [
  {
    documentClass: "validation_verification_report",
    pattern: /\bvalidation\s*(?:and|&|\/)\s*verification\s*report\b/i,
    repeatedPattern: /\bvalidation\s*(?:and|&|\/)\s*verification\s*report\b/gi,
  },
  {
    documentClass: "validation_verification_report",
    pattern: /\bverification\s*(?:and|&|\/)\s*validation\s*report\b/i,
    repeatedPattern: /\bverification\s*(?:and|&|\/)\s*validation\s*report\b/gi,
  },
  {
    documentClass: "verification_report",
    pattern: /\bverification\s*report\b/i,
    repeatedPattern: /\bverification\s*report\b/gi,
  },
  {
    documentClass: "validation_report",
    pattern: /\bvalidation\s*report\b/i,
    repeatedPattern: /\bvalidation\s*report\b/gi,
  },
  {
    documentClass: "monitoring_report",
    pattern: /\bmonitoring\s*report\b/i,
    repeatedPattern: /\bmonitoring\s*report\b/gi,
  },
  {
    documentClass: "project_description_pdd",
    pattern: /\bproject\s*description(?:\s*document)?\b/i,
    repeatedPattern: /\bproject\s*description(?:\s*document)?\b/gi,
  },
  {
    documentClass: "project_description_pdd",
    pattern: /\bproject\s*design\s*document\b/i,
    repeatedPattern: /\bproject\s*design\s*document\b/gi,
  },
  {
    documentClass: "methodology_document",
    pattern: /\bmethodology\s*(?:document|framework|tool|module)\b/i,
    repeatedPattern: /\bmethodology\s*(?:document|framework|tool|module)\b/gi,
  },
  {
    documentClass: "risk_report",
    pattern: /\bnon[- ]?permanence\s*risk\s*report\b/i,
    repeatedPattern: /\bnon[- ]?permanence\s*risk\s*report\b/gi,
  },
];

function documentClassLabel(documentClass: QuickCheckDocumentClass): string {
  const labels: Record<QuickCheckDocumentClass, string> = {
    project_description_pdd: "Project Description / PD",
    monitoring_report: "Monitoring Report",
    validation_report: "Validation Report",
    verification_report: "Verification Report",
    validation_verification_report: "Validation & Verification Report",
    methodology_document: "Methodology Document",
    risk_report: "Risk Report",
    supporting_evidence_file: "Supporting Evidence File",
    registry_or_public_record: "Registry / Public Record",
    unknown_carbon_document: "Carbon Document (unclassified)",
    non_carbon_document: "Non-Carbon Document",
  };
  return labels[documentClass];
}

export function quickCheckDocumentClassLabel(documentClass: QuickCheckDocumentClass): string {
  return documentClassLabel(documentClass);
}

export function classifyQuickCheckDocument(input: QuickCheckDocumentClassifierInput): QuickCheckDocumentClassification {
  const fileName = normalizeWhitespace(input.fileName ?? "");
  const mime = normalizeWhitespace(input.mime ?? "").toLowerCase();
  const rawText = input.rawText ?? "";
  const lines = compactLines(rawText);
  const headerLines = lines.slice(0, TOP_LINE_COUNT);
  const repeatedHeaders = buildRepeatedHeaders(lines);
  const titleBlockLines = buildTitleBlock(headerLines, repeatedHeaders);
  const titleBlockText = titleBlockLines.join("\n");
  const headerText = headerLines.join("\n");
  const tocLines = buildTocLines(lines);
  const topTables = buildTopTables(lines);
  const bodyText = lines.join("\n");
  const scores = new Map<RuleClass, ScoreEntry>();

  if (mime.includes("image/")) {
    addEvidence(scores, "supporting_evidence_file", 0.8, `media type: "${mime}"`);
  } else if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) {
    addEvidence(scores, "supporting_evidence_file", 1.0, `media type: "${mime}"`);
  } else if (mime === "application/pdf") {
    addEvidence(scores, "project_description_pdd", 0.1, `media type: "${mime}"`);
  }

  addDirectPhraseSignals(scores, rawText, CLASS_PHRASE_DEFINITIONS);
  addCompactedTitleSignals(scores, rawText);

  for (const ruleSet of FILENAME_RULES) {
    applyPatterns(scores, ruleSet.documentClass, fileName, ruleSet.patterns);
  }
  if (titleBlockText) {
    for (const ruleSet of HEADER_RULES) {
      const titlePatterns = ruleSet.patterns.map((rule) => ({
        ...rule,
        weight: rule.weight * 1.35,
        source: "title_block" as const,
      }));
      applyPatterns(scores, ruleSet.documentClass, titleBlockText, titlePatterns);
    }
  }
  for (const ruleSet of HEADER_RULES) {
    applyPatterns(scores, ruleSet.documentClass, headerText, ruleSet.patterns);
  }
  for (const repeated of repeatedHeaders) {
    for (const ruleSet of HEADER_RULES) {
      const repeatedPatterns = ruleSet.patterns.map((rule) => ({ ...rule, weight: Math.max(0.4, rule.weight * 0.55), source: "repeated_header" as const }));
      applyPatterns(scores, ruleSet.documentClass, repeated, repeatedPatterns);
    }
  }
  for (const tocLine of tocLines) {
    for (const ruleSet of HEADER_RULES) {
      const tocPatterns = ruleSet.patterns.map((rule) => ({ ...rule, weight: Math.max(0.35, rule.weight * 0.45), source: "toc" as const }));
      applyPatterns(scores, ruleSet.documentClass, tocLine, tocPatterns);
    }
  }
  for (const tableText of topTables) {
    for (const ruleSet of BODY_RULES) {
      const tablePatterns = ruleSet.patterns.map((rule) => ({ ...rule, weight: Math.max(0.35, rule.weight * 0.55), source: "table" as const }));
      applyPatterns(scores, ruleSet.documentClass, tableText, tablePatterns);
    }
  }
  for (const ruleSet of BODY_RULES) {
    applyPatterns(scores, ruleSet.documentClass, bodyText, ruleSet.patterns);
  }

  const carbonSignalCount = (bodyText.match(/\bcarbon\b|\bghg\b|\bverra\b|\bvcs\b|\bccb\b|\bcdm\b|\bredd\b|\bmonitoring\b|\bvalidation\b|\bverification\b|\bmethodology\b|\bproject boundary\b|\bboundary description\b|\bproject area\b|\bmapped project area\b|\baoi\b|\bproject description\b|\bproject document\b/gi) ?? []).length;
  const nonCarbonSignalCount = (bodyText.match(/\binvoice\b|\bresume\b|\bproposal\b|\bmeeting minutes\b|\bmarketing\b|\bmaster services agreement\b|\bpurchase order\b/gi) ?? []).length;
  if (nonCarbonSignalCount >= 2) addEvidence(scores, "non_carbon_document", 1.1, `body: "${nonCarbonSignalCount} non-carbon keyword matches"`);

  const ranked = Array.from(scores.entries())
    .map(([documentClass, entry]) => ({
      documentClass,
      score: entry.score,
      evidence: entry.evidence.slice(0, 6),
    }))
    .sort((left, right) =>
      right.score - left.score
      || right.evidence.length - left.evidence.length
      || DOCUMENT_CLASS_ORDER.indexOf(left.documentClass) - DOCUMENT_CLASS_ORDER.indexOf(right.documentClass)
    );

  const best = ranked[0];
  const second = ranked[1];

  if (
    best
    && best.documentClass === "supporting_evidence_file"
    && (
      best.score < 1.4
      || (carbonSignalCount === 0 && /\badministrative notes?\b/i.test(bodyText))
    )
  ) {
    return {
      documentClass: "unknown_carbon_document",
      confidence: clampConfidence(0.33),
      evidence: best.evidence,
      secondaryCandidates: ranked.slice(1, 4).map((candidate) => ({
        documentClass: candidate.documentClass,
        confidence: clampConfidence(0.2 + candidate.score * 0.1),
        evidence: candidate.evidence,
      })),
      warnings: buildWarnings(best.score, second?.score ?? 0, best.evidence.length, rawText),
    };
  }

  if (!best || best.score < 0.85) {
    const unknownClass: QuickCheckDocumentClass = carbonSignalCount >= 2 ? "unknown_carbon_document" : "non_carbon_document";
    const fallbackEvidence = fileName ? [`filename: "${fileName}"`] : [];
    return {
      documentClass: unknownClass,
      confidence: clampConfidence(unknownClass === "unknown_carbon_document" ? 0.34 : 0.48),
      evidence: fallbackEvidence,
      secondaryCandidates: ranked.slice(0, 3).map((candidate) => ({
        documentClass: candidate.documentClass,
        confidence: clampConfidence(0.22 + candidate.score * 0.1),
        evidence: candidate.evidence,
      })),
      warnings: buildWarnings(best?.score ?? 0, second?.score ?? 0, fallbackEvidence.length, rawText),
    };
  }

  const confidence = deriveConfidence(best.score, second?.score ?? 0, best.evidence.length);
  return {
    documentClass: best.documentClass,
    confidence,
    evidence: best.evidence,
    secondaryCandidates: ranked.slice(1, 4).map((candidate) => ({
      documentClass: candidate.documentClass,
      confidence: clampConfidence(0.2 + candidate.score * 0.1),
      evidence: candidate.evidence,
    })),
    warnings: buildWarnings(best.score, second?.score ?? 0, best.evidence.length, rawText),
  };
}
