import type { DocumentStructure } from "@/lib/documentModel";
import { normalizeMethodologyVersion } from "@/lib/chat/methodologyVersion";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

export const EVIDENCE_AUDIT_STATUSES = [
  "supported_by_pdd",
  "partially_supported",
  "missing_evidence",
  "not_applicable",
  "manual_review_needed",
] as const;

export type EvidenceAuditStatus = (typeof EVIDENCE_AUDIT_STATUSES)[number];
export type EvidenceAuditConfidence = "high" | "medium" | "low";
export type EvidenceType =
  | "project_specific_implementation"
  | "project_specific_scope"
  | "methodology_boilerplate"
  | "module_or_tool_declaration"
  | "incomplete_or_noisy";

export type MandatoryEvidenceComponent = Readonly<{
  id: string;
  description: string;
  signals: readonly string[];
}>;

export type ApplicabilityConfiguration = Readonly<{
  exclusionSignals: readonly string[];
  contextSignals: readonly string[];
  requireProjectSpecificContext: boolean;
  requireRuleSubjectAlignment?: boolean;
}>;

export type MethodologyVersionLock = Readonly<{
  methodologyId: string;
  rulebookVersionRaw: string;
  rulebookVersionKey: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersionRaw: string;
  pddDeclaredMethodologyVersion: string;
  versionMatch: boolean;
  versionMismatchReason: string;
  userAcceptedVersionWarning?: boolean;
}>;

export type MethodologyEvidenceContract = Readonly<{
  id: string;
  label: string;
  methodologyId: string;
  rulebookVersion: string;
  appliesToFamily?: string;
  appliesToRuleIds?: readonly string[];
  pddSectionsToSearch: readonly string[];
  strongEvidenceSignals: readonly string[];
  weakEvidenceSignals: readonly string[];
  rejectSignals: readonly string[];
  notApplicableSignals: readonly string[];
  applicability?: ApplicabilityConfiguration;
  mandatoryComponents?: readonly MandatoryEvidenceComponent[];
  defaultGapMessage: string;
  clientAction: string;
  supportsNotApplicable: boolean;
}>;

export type MethodologyRuleLike = {
  id: string;
  title?: string;
  summary?: string;
  type?: string;
};

export type MethodologyEvidenceAuditRule = MethodologyRuleLike & {
  stableId?: string;
  logic?: string;
  text?: string;
};

export type MethodologyEvidenceAuditResult = {
  ruleId: string;
  stableId: string;
  title: string;
  ruleLogic: string;
  methodologyId?: string;
  rulebookVersionRaw?: string;
  rulebookVersionKey?: string;
  rulebookVersion?: string;
  pddDeclaredMethodologyVersionRaw?: string;
  pddDeclaredMethodologyVersion?: string;
  versionMatch?: boolean;
  versionMismatchReason?: string;
  userAcceptedVersionWarning?: boolean;
  status: EvidenceAuditStatus;
  bestEvidenceQuote: string | null;
  /** Lossless source-backed records; legacy scalar fields remain for compatibility. */
  evidence?: readonly MethodologyEvidenceRecord[];
  /** Rejected source-backed candidates retained for diagnostics without presenting them as accepted evidence. */
  rejectedEvidence?: readonly MethodologyEvidenceRecord[];
  supportedComponents?: readonly string[];
  missingComponents?: readonly string[];
  page: number | null;
  section: string | null;
  span: string | null;
  reasonSelected: string;
  assessmentReason: string;
  gap: string;
  clientAction: string;
  confidence: EvidenceAuditConfidence;
};

export type MethodologyEvidenceRecord = Readonly<{
  quote: string;
  page: number | null;
  section: string | null;
  span: string;
  evidenceType?: EvidenceType;
  rejectionReason?: string;
}>;

export type MethodologyEvidenceAuditSummary = {
  auditStatus?: "AUDITED" | "VERSION_WARNING_ACCEPTED" | "BLOCKED_VERSION_MISMATCH";
  methodologyId?: string;
  rulebookVersionRaw?: string;
  rulebookVersionKey?: string;
  rulebookVersion?: string;
  pddDeclaredMethodologyVersionRaw?: string;
  pddDeclaredMethodologyVersion?: string;
  versionMatch?: boolean;
  versionMismatchReason?: string;
  userAcceptedVersionWarning?: boolean;
  results: MethodologyEvidenceAuditResult[];
  totals: Record<EvidenceAuditStatus, number>;
  totalRules: number;
  diagnosticTrace?: readonly EvidenceAuditDiagnosticTrace[];
};

export type EvidenceAuditDiagnosticCandidate = Readonly<{
  spanId: string;
  quote: string;
  page: number | null;
  score: number;
  evidenceType: EvidenceType;
  rejectionReason: string | null;
}>;

export type EvidenceAuditDiagnosticTrace = Readonly<{
  stableId: string;
  retrievalCandidates: readonly EvidenceAuditDiagnosticCandidate[];
  postFilterCandidates: readonly EvidenceAuditDiagnosticCandidate[];
  selectedCandidates: readonly EvidenceAuditDiagnosticCandidate[];
  cutoffPosition: number;
}>;

export type MethodologyEvidenceAuditInput = {
  rules: readonly MethodologyEvidenceAuditRule[];
  evidenceDocument: EvidenceDocument;
  getContract: (rule: MethodologyRuleLike | string) => MethodologyEvidenceContract;
  normalizeRuleId?: (ruleId: string) => string;
  versionContext?: Partial<Pick<MethodologyVersionLock, "methodologyId" | "rulebookVersion" | "pddDeclaredMethodologyVersion">> & {
    pddDeclaredMethodologyId?: string;
  };
  userAcceptedVersionWarning?: boolean;
  sections?: readonly Pick<
    DocumentStructure["sections"][number],
    "id" | "sectionNumber" | "titleRaw" | "titleClean" | "bodyRaw" | "bodyClean"
  >[];
  rawText?: string;
  diagnosticTrace?: boolean;
};

type SectionLike = NonNullable<MethodologyEvidenceAuditInput["sections"]>[number];

type CandidateScore = {
  span: EvidenceSpan;
  sectionTitle: string | null;
  score: number;
  strongHits: number;
  signalTokenHits: number;
  weakHits: number;
  rejectHits: number;
  ruleHits: number;
  sectionHits: number;
  projectFactBonus: number;
  evidenceType: EvidenceType;
  rejectionReason: string | null;
};

const SECTION_STOPWORDS = new Set([
  "section",
  "project",
  "conditions",
  "condition",
  "description",
  "method",
  "methodology",
  "estimated",
  "emission",
  "emissions",
  "reduction",
  "reductions",
  "removals",
  "summary",
  "task",
  "tasks",
  "requirement",
  "requirements",
  "data",
  "parameters",
  "plan",
  "activity",
  "activities",
  "rule",
  "rules",
  "type",
  "types",
  "per",
  "via",
  "and",
  "the",
  "for",
  "from",
  "with",
  "that",
  "this",
  "into",
  "than",
]);

const TEXT_STOPWORDS = new Set([
  ...SECTION_STOPWORDS,
  "must",
  "have",
  "uses",
  "used",
  "using",
  "shall",
  "under",
  "within",
  "through",
  "documented",
  "documentation",
  "provide",
  "provides",
  "provided",
  "all",
  "other",
  "only",
  "their",
  "there",
  "where",
  "which",
  "when",
  "what",
  "into",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^\w\s/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMethodologyId(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeVersionValue(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return normalizeMethodologyVersion(trimmed) ?? (trimmed.startsWith("v") ? trimmed : `v${trimmed}`);
}

function normalizeVersionKey(value: string | null | undefined): string {
  return normalizeVersionValue(value).toLowerCase();
}

function isStandaloneDeclaredVersion(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return normalizeMethodologyVersion(trimmed) !== null
    && /^(?:version\s+|ver\.?\s*|v\.?\s*)?\d+(?:[.-]\d+)*$/i.test(trimmed);
}

function extractDeclaredMethodologyId(rawValue: string): string {
  const normalized = rawValue.trim().toUpperCase();
  const match = normalized.match(/\b(VM\d{4}|AMS-[A-Z0-9.]+|AR-[A-Z0-9.]+|ACM\d{4}|AM\d{4}|GS-[A-Z0-9.]+)\b/);
  return match?.[1] ?? "";
}

const METHODOLOGY_DECLARATION_HEADINGS = [
  /\btitle and reference of methodology\b/i,
  /\btitle and reference of approved baseline methodology applied\b/i,
  /\bname and reference of approved monitoring methodology applied\b/i,
  /\bapplication of methodology\b/i,
  /\bmethodology applied\b/i,
] as const;

const METHODOLOGY_DECLARATION_ANCHORS = [
  /\bVM0007\b/i,
  /\bREDD[-\s]?MF\b/i,
  /\bREDD\s+Methodology\s+Framework\b/i,
] as const;

const TABLE_ROW_BOUNDARY_PATTERNS = [
  /^(?:carbon pool modules?|baseline module|leakage modules?|monitoring module|miscellaneous modules?|tools?|modules and tools)\b/i,
  /^(?:type|reference id|version|module id|tool id|section|chapter|appendix|table|figure)\b/i,
  /^(?:vcs standard|ccb standard|document version)\b/i,
] as const;

const METHODOLOGY_BLOCK_START_PATTERNS = [
  /\b3\.1\.1\s+title and reference of methodology\b/i,
  /\b2\.1\s+title and reference of methodology\b/i,
  /\btitle and reference of methodology applied\b/i,
  /\btitle and reference of methodology\b/i,
] as const;

const METHODOLOGY_BLOCK_END_PATTERNS = [
  /\b3\.1\.2\s+applicability of methodology\b/i,
  /\b2\.2\s+applicability of methodology\b/i,
  /\bapplicability of methodology\b/i,
] as const;

function isTableBoundaryLine(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) return true;
  return TABLE_ROW_BOUNDARY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractMethodologyVersionCellTokens(text: string): string[] {
  const cleaned = text.replace(/\[\s*\d+\s*\]/g, " ").trim();
  return Array.from(
    new Set(
      Array.from(cleaned.matchAll(/\b(?:version\s*|v\.?\s*)?(\d+(?:[.-]\d+)+)\b/gi))
        .map((match) => normalizeVersionValue(match[1] ?? ""))
        .filter(Boolean),
    ),
  );
}

function extractExplicitVersionTokens(text: string): string[] {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/\b(?:version\s+|v\.?\s*)(\d+(?:[.-]\d+)*)\b/gi))
        .map((match) => normalizeVersionValue(match[1] ?? ""))
        .filter(Boolean),
    ),
  );
}

function extractDeclaredVersionTokens(text: string): string[] {
  const explicitVersions = extractExplicitVersionTokens(text);
  if (explicitVersions.length > 0) return explicitVersions;

  const contextualVersion = normalizeMethodologyVersion(text);
  return contextualVersion ? [contextualVersion] : [];
}

function extractDeclaredVersionTokensFromContinuation(input: {
  line: string;
  nextLine?: string;
}): string[] {
  const currentLineVersions = extractDeclaredVersionTokens(input.line);
  if (currentLineVersions.length > 0) return currentLineVersions;

  const nextLine = input.nextLine?.trim() ?? "";
  if (!nextLine || isTableBoundaryLine(nextLine)) return [];

  const combinedVersions = extractDeclaredVersionTokens(`${input.line} ${nextLine}`.trim());
  if (combinedVersions.length > 0) return combinedVersions;

  return extractDeclaredVersionTokens(nextLine);
}

function extractMethodologyBlock(rawText: string): string {
  const lines = rawText.split(/\n+/);
  const startIndex = lines.findIndex((line) =>
    METHODOLOGY_BLOCK_START_PATTERNS.some((pattern) => pattern.test(line)),
  );
  if (startIndex < 0) return rawText;

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (METHODOLOGY_BLOCK_END_PATTERNS.some((pattern) => pattern.test(lines[index] ?? ""))) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
}

function extractFlattenedMethodologyRow(blockText: string, expectedMethodologyId: string): {
  declaredMethodologyId: string;
  declaredRulebookVersions: string[];
} | null {
  const rowMatch = blockText.match(
    new RegExp(
      String.raw`Type\s+Methodology\b[\s\S]{0,240}?Reference\s+ID\s+${expectedMethodologyId}\b[\s\S]{0,240}?(?=Type\s+(?:Methodology|Module|Tool)\b|3\.1\.2\b|2\.2\b|Applicability of Methodology|$)`,
      "i",
    ),
  );
  if (!rowMatch?.[0]) return null;

  const rowLine = rowMatch[0]
    .split("\n")
    .find((line) => /\bversion\b/i.test(line))
    ?? rowMatch[0];
  const versionCellText = rowLine.match(/\bVersion\b([^\n]{0,80})/i)?.[1] ?? "";
  return {
    declaredMethodologyId: expectedMethodologyId,
    declaredRulebookVersions: extractMethodologyVersionCellTokens(versionCellText),
  };
}

function collectProseDeclaredVersions(lines: string[], expectedMethodologyId: string): string[] {
  const declaredVersions: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const hasExplicitMethodologyAnchor =
      (expectedMethodologyId && new RegExp(`\\b${expectedMethodologyId}\\b`, "i").test(line))
      || METHODOLOGY_DECLARATION_ANCHORS.some((pattern) => pattern.test(line));
    if (!hasExplicitMethodologyAnchor) continue;

    const nextLine = lines[index + 1]?.trim();
    const lineVersions = extractDeclaredVersionTokensFromContinuation({
      line,
      nextLine,
    });
    if (lineVersions.length > 0) {
      declaredVersions.push(...lineVersions);
      continue;
    }
  }

  return Array.from(new Set(declaredVersions));
}

function extractDeclaredMethodologyReferenceFromTables(input: {
  evidenceDocument: EvidenceDocument;
  expectedMethodologyId: string;
}): { declaredMethodologyId: string; declaredRulebookVersions: string[] } | null {
  for (const span of input.evidenceDocument.spans) {
    if (span.blockType !== "table" || span.table?.limitedProvenance) continue;
    const contextText = `${span.heading ?? ""} ${span.headingPath.join(" ")} ${span.sectionPath.join(" ")} ${span.text}`;
    if (!METHODOLOGY_DECLARATION_HEADINGS.some((pattern) => pattern.test(contextText))) continue;
    if (!span.table?.cells?.length) continue;

    const headerRowCount = span.table.headerRowCount ?? 0;
    const versionColumnIndexes = new Set(
      span.table.cells
        .filter((cell) => cell.rowIndex < headerRowCount && /\bversion\b/i.test(cell.text))
        .map((cell) => cell.columnIndex),
    );

    const rows = new Map<number, typeof span.table.cells>();
    for (const cell of span.table.cells) {
      if (headerRowCount && cell.rowIndex < headerRowCount) continue;
      const row = rows.get(cell.rowIndex) ?? [];
      row.push(cell);
      rows.set(cell.rowIndex, row);
    }

    for (const rowCells of rows.values()) {
      const rowText = rowCells.map((cell) => cell.text).join(" ").trim();
      if (!rowText || !/methodology/i.test(rowText)) continue;
      if (input.expectedMethodologyId && !new RegExp(`\\b${input.expectedMethodologyId}\\b`, "i").test(rowText)) continue;
      const versionCellText = rowCells
        .filter((cell) => versionColumnIndexes.has(cell.columnIndex))
        .map((cell) => cell.text)
        .join(" ")
        .trim();
      const declaredRulebookVersions = extractMethodologyVersionCellTokens(versionCellText);
      return {
        declaredMethodologyId: input.expectedMethodologyId || extractDeclaredMethodologyId(rowText) || "",
        declaredRulebookVersions,
      };
    }
  }

  return null;
}

function extractDeclaredMethodologyReferenceFromText(rawText: string, expectedMethodologyId?: string): {
  declaredMethodologyId: string;
  declaredRulebookVersions: string[];
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      declaredMethodologyId: "",
      declaredRulebookVersions: [],
    };
  }

  const expectedId = normalizeMethodologyId(expectedMethodologyId);
  const methodologyBlock = extractMethodologyBlock(trimmed);
  const flattenedMethodologyRow = expectedId
    ? extractFlattenedMethodologyRow(methodologyBlock, expectedId)
    : null;
  if (flattenedMethodologyRow) return flattenedMethodologyRow;

  const lines = methodologyBlock.split(/\n+/);
  const declarationVersions = collectProseDeclaredVersions(lines, expectedId);
  const extractedMethodologyId = extractDeclaredMethodologyId(methodologyBlock);
  const declaredMethodologyId = extractedMethodologyId || (declarationVersions.length > 0 ? expectedId : "");

  return {
    declaredMethodologyId,
    declaredRulebookVersions: declarationVersions,
  };
}

function buildVersionMismatchReason(input: {
  methodologyId: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersion: string;
  declaredMethodologyId: string;
  declaredRulebookVersions: readonly string[];
}): string {
  const problems: string[] = [];
  if (!input.declaredMethodologyId) {
    problems.push("PDD-declared methodology ID is missing");
  } else if (normalizeMethodologyId(input.declaredMethodologyId) !== normalizeMethodologyId(input.methodologyId)) {
    problems.push(`methodology ID mismatch: PDD declares ${input.declaredMethodologyId}, loaded contract is ${input.methodologyId}`);
  }

  if (input.declaredRulebookVersions.length === 0) {
    problems.push("PDD-declared methodology version is missing");
  } else {
    const canonicalDeclaredRulebookVersions = Array.from(
      new Set(input.declaredRulebookVersions.map((version) => normalizeVersionKey(version)).filter(Boolean)),
    );
    if (canonicalDeclaredRulebookVersions.length > 1) {
      problems.push(`PDD-declared methodology version is ambiguous: found ${input.declaredRulebookVersions.join(", ")}`);
    } else if (normalizeVersionKey(input.declaredRulebookVersions[0] ?? "") !== normalizeVersionKey(input.rulebookVersion)) {
      problems.push(`rulebook version mismatch: PDD declares ${normalizeVersionValue(input.declaredRulebookVersions[0] ?? "")}, loaded contract is ${normalizeVersionValue(input.rulebookVersion)}`);
    }
  }

  if (problems.length === 0) return "";
  return `Version lock blocked: ${problems.join("; ")}.`;
}

export function buildMethodologyVersionLock(input: {
  methodologyId: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersion: string;
  pddDeclaredMethodologyId?: string;
  userAcceptedVersionWarning?: boolean;
}): MethodologyVersionLock {
  const methodologyId = normalizeMethodologyId(input.methodologyId);
  const rulebookVersionRaw = input.rulebookVersion.trim();
  const rulebookVersion = normalizeVersionValue(rulebookVersionRaw);
  const pddDeclaredMethodologyVersionRaw = input.pddDeclaredMethodologyVersion.trim();
  const standaloneDeclaredVersion = isStandaloneDeclaredVersion(pddDeclaredMethodologyVersionRaw)
    ? normalizeMethodologyVersion(pddDeclaredMethodologyVersionRaw)
    : null;
  const declaredMethodologyId = input.pddDeclaredMethodologyId === undefined
    ? methodologyId
    : normalizeMethodologyId(input.pddDeclaredMethodologyId);
  const declaredReference = standaloneDeclaredVersion
    ? {
      declaredMethodologyId,
      declaredRulebookVersions: [standaloneDeclaredVersion],
    }
    : extractDeclaredMethodologyReferenceFromText(pddDeclaredMethodologyVersionRaw, methodologyId);
  const pddDeclaredMethodologyVersion = declaredReference.declaredRulebookVersions.length === 1
    ? normalizeVersionValue(declaredReference.declaredRulebookVersions[0] ?? "")
    : standaloneDeclaredVersion ?? pddDeclaredMethodologyVersionRaw;
  const versionMismatchReason = buildVersionMismatchReason({
    methodologyId,
    rulebookVersion,
    pddDeclaredMethodologyVersion: pddDeclaredMethodologyVersionRaw,
    declaredMethodologyId: declaredReference.declaredMethodologyId,
    declaredRulebookVersions: declaredReference.declaredRulebookVersions,
  });

  return Object.freeze({
    methodologyId,
    rulebookVersionRaw,
    rulebookVersionKey: rulebookVersionRaw,
    rulebookVersion,
    pddDeclaredMethodologyVersionRaw,
    pddDeclaredMethodologyVersion,
    versionMatch: versionMismatchReason.length === 0,
    versionMismatchReason,
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
  });
}

function tokenize(value: string | null | undefined, stopwords: Set<string>): string[] {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  return Array.from(new Set(tokens.filter((token) => token.length > 2 && !stopwords.has(token))));
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  return normalizedPhrase.length > 0 && text.includes(normalizedPhrase);
}

function countPhraseHits(text: string, phrases: readonly string[]): number {
  let hits = 0;
  for (const phrase of phrases) {
    if (includesPhrase(text, phrase)) hits += 1;
  }
  return hits;
}

function countTokenHits(text: string, tokens: readonly string[]): number {
  let hits = 0;
  for (const token of tokens) {
    if (text.includes(token)) hits += 1;
  }
  return hits;
}

function countEvidenceSignalMatches(text: string, signals: readonly string[]): number {
  const normalizedText = normalizeText(text);
  return signals.filter((signal) => {
    if (includesPhrase(normalizedText, signal)) return true;
    const distinctiveTokens = tokenize(signal, TEXT_STOPWORDS).filter((token) => token.length >= 4);
    return distinctiveTokens.filter((token) => normalizedText.includes(token)).length >= 2;
  }).length;
}

function sourceQuote(text: string): string {
  // Normalize layout whitespace, but never paraphrase or truncate the source span.
  return text.replace(/\s+/g, " ").trim();
}

function normalizeRuleId(ruleId: string, normalize?: (ruleId: string) => string): string {
  return normalize ? normalize(ruleId) : ruleId.trim();
}

function resolveRuleTitle(rule: MethodologyEvidenceAuditRule): string {
  return rule.title?.trim() || rule.summary?.trim() || rule.id.trim();
}

function resolveRuleLogic(rule: MethodologyEvidenceAuditRule): string {
  return rule.logic?.trim() || rule.text?.trim() || rule.summary?.trim() || resolveRuleTitle(rule);
}

function resolveStableId(rule: MethodologyEvidenceAuditRule): string {
  return rule.stableId?.trim() || rule.id.trim();
}

function resolveAuditVersionLock(input: MethodologyEvidenceAuditInput): MethodologyVersionLock {
  const firstRule = input.rules[0];
  const firstContract = firstRule ? input.getContract(firstRule) : null;
  const resolvedMethodologyId = input.versionContext?.methodologyId?.trim()
    || firstContract?.methodologyId
    || "";
  const rulebookVersion = input.versionContext?.rulebookVersion?.trim()
    || firstContract?.rulebookVersion
    || "";
  const tableDeclaredReference = extractDeclaredMethodologyReferenceFromTables({
    evidenceDocument: input.evidenceDocument,
    expectedMethodologyId: resolvedMethodologyId,
  });
  const declaredReference = tableDeclaredReference ?? extractDeclaredMethodologyReferenceFromText(input.rawText ?? "", resolvedMethodologyId);
  const versionContextValue = input.versionContext?.pddDeclaredMethodologyVersion;
  const inferredDeclaredVersion = declaredReference.declaredRulebookVersions.length > 0
    ? [declaredReference.declaredMethodologyId, ...declaredReference.declaredRulebookVersions].filter(Boolean).join(" ").trim()
    : "";
  const pddDeclaredMethodologyVersion = versionContextValue !== undefined
    ? versionContextValue.trim()
    : inferredDeclaredVersion;

  return buildMethodologyVersionLock({
    methodologyId: resolvedMethodologyId,
    rulebookVersion,
    pddDeclaredMethodologyVersion,
    pddDeclaredMethodologyId: input.versionContext?.methodologyId?.trim() || declaredReference.declaredMethodologyId,
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
  });
}

function buildSectionLookup(sections: readonly SectionLike[] | undefined): Map<string, SectionLike> {
  const lookup = new Map<string, SectionLike>();
  for (const section of sections ?? []) lookup.set(section.id, section);
  return lookup;
}

function isNotApplicableEligible(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): boolean {
  return contract.supportsNotApplicable && contract.notApplicableSignals.length > 0;
}

function deriveSectionSignals(contract: MethodologyEvidenceContract): string[] {
  return contract.pddSectionsToSearch.map((entry) =>
    entry.replace(/^S-\d(?:-\d+)?\s*/i, "").trim(),
  );
}

function deriveRuleTokens(rule: MethodologyEvidenceAuditRule): string[] {
  return tokenize(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`, TEXT_STOPWORDS);
}

function deriveSectionTokens(contract: MethodologyEvidenceContract, rule: MethodologyEvidenceAuditRule): string[] {
  return tokenize(
    `${deriveSectionSignals(contract).join(" ")} ${resolveRuleTitle(rule)}`,
    SECTION_STOPWORDS,
  );
}

function deriveContractSignalPhrases(contract: MethodologyEvidenceContract): string[] {
  return [
    ...contract.strongEvidenceSignals,
    ...contract.weakEvidenceSignals,
    contract.label,
    contract.appliesToFamily ?? "",
  ].filter(Boolean);
}

function intersectionCount(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  let count = 0;
  for (const item of left) {
    if (rightSet.has(item)) count += 1;
  }
  return count;
}

function hasProjectSpecificMarkers(text: string): boolean {
  return /\b(project area|project proponent|community|communities|annex|agreement|schedule|annual|annually|plot|plots|field team|gps|coordinates|hectares|buffer communities|forest users|indigenous|representatives)\b/.test(text)
    || /\b(?:the project|project activities|project activity|project scope)\b/.test(text);
}

const ALIGNMENT_STOPWORDS = new Set([
  ...TEXT_STOPWORDS,
  "applicable",
  "application",
  "condition",
  "conditions",
  "evidence",
  "information",
  "project",
  "requirement",
  "requirements",
  "scenario",
  "scenarios",
  "plan",
]);

const GENERIC_ALIGNMENT_SUBJECT_TOKENS = new Set([
  "applicable",
  "application",
  "baseline",
  "condition",
  "conditions",
  "monitoring",
  "project",
  "activity",
  "activities",
  "requirement",
  "requirements",
]);

function alignmentFragments(text: string): string[] {
  return text
    .split(/(?<=[.!?;:])\s+|\n{2,}/)
    .map((fragment) => normalizeText(fragment))
    .filter(Boolean);
}

function meaningfulAlignmentTokenCount(text: string): number {
  return tokenize(text, ALIGNMENT_STOPWORDS)
    .filter((token) => !GENERIC_ALIGNMENT_SUBJECT_TOKENS.has(token)).length;
}

function ruleAlignmentSubjectTokens(
  rule: MethodologyEvidenceAuditRule,
  contract: MethodologyEvidenceContract,
): string[] {
  return tokenize([
    resolveRuleTitle(rule),
    rule.summary ?? "",
    resolveRuleLogic(rule),
    contract.label,
    contract.appliesToFamily ?? "",
    ...contract.strongEvidenceSignals,
    ...(contract.mandatoryComponents ?? []).flatMap((component) => component.signals),
  ].join(" "), ALIGNMENT_STOPWORDS).filter((token) =>
    token.length >= 4 && !GENERIC_ALIGNMENT_SUBJECT_TOKENS.has(token),
  );
}

function hasSubstantiveLocalProjectFact(fragment: string): boolean {
  return hasProjectSpecificMarkers(fragment)
    || projectFactBonus(fragment) > 0
    || hasExplicitScopeExclusion(fragment)
    || /\b(?:project|project activity)\b[\s\S]{0,100}\b(?:reduces?|authori[sz]ed|documented|implemented)\b/i.test(fragment);
}

/**
 * Complementary evidence must prove both sides of the relationship locally.
 * This deliberately operates on deterministic sentence/clause fragments so a
 * project marker in one part of a stitched span cannot align unrelated rule
 * vocabulary found elsewhere in that span.
 */
export function hasLocalRuleAlignment(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  text: string;
  evidenceType?: EvidenceType;
}): boolean {
  const subjectTokens = ruleAlignmentSubjectTokens(input.rule, input.contract);
  const strongSignalPhrases = input.contract.strongEvidenceSignals
    .filter(Boolean)
    .map(normalizeText);
  const contractSubjectPhrases = [input.contract.label, input.contract.appliesToFamily ?? ""]
    .filter(Boolean)
    .map(normalizeText)
    .filter((phrase) => phrase.length >= 4 && meaningfulAlignmentTokenCount(phrase) >= 2);
  const directRuleSubjectPhrases = [
    resolveRuleTitle(input.rule),
    input.contract.label,
  ].map(normalizeText).filter((phrase) => {
    return phrase.length >= 4 && meaningfulAlignmentTokenCount(phrase) >= 2;
  });

  return alignmentFragments(input.text).some((fragment) => {
    const hasLocalProjectFact = hasSubstantiveLocalProjectFact(fragment);
    if (!hasLocalProjectFact) return false;

    const strongPhraseHit = strongSignalPhrases.some((phrase) =>
      phrase.length >= 12 && fragment.includes(phrase),
    );
    const exactPhraseHit = strongPhraseHit
      || contractSubjectPhrases.some((phrase) => fragment.includes(phrase))
      || directRuleSubjectPhrases.some((phrase) => fragment.includes(phrase));
    if (exactPhraseHit) return true;
    const fragmentTokens = tokenize(fragment, ALIGNMENT_STOPWORDS);
    const subjectHits = new Set(subjectTokens.filter((token) => fragmentTokens.some((fragmentToken) =>
      token === fragmentToken
      || (Math.min(token.length, fragmentToken.length) >= 5
        && (token.startsWith(fragmentToken) || fragmentToken.startsWith(token))),
    )));
    const substantiveImplementation = /\b(?:measured|calculated|quantified|implemented|monitored|recorded|surveyed|mapped|sampled|collected|analysed|analyzed|determined|estimated|verified|documented|qualifies|eligible|authori[sz]ed|reduces?|spans?|follows|implement)\b/i.test(fragment);
    return subjectHits.size >= 2
      || (subjectHits.size === 1 && substantiveImplementation);
  });
}

const COMPLEMENTARY_ALIGNMENT_REJECTION =
  "The span contains project-specific content but is not sufficiently aligned with the current rule.";

function applyComplementaryAlignmentGate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  bestCandidate: CandidateScore;
  candidates: readonly CandidateScore[];
}): CandidateScore[] {
  return input.candidates.map((candidate) => {
    if (candidate.span.spanId === input.bestCandidate.span.spanId
      || !isAcceptedProjectEvidence(candidate)
      || hasLocalRuleAlignment({
        rule: input.rule,
        contract: input.contract,
        text: candidate.span.text,
        evidenceType: candidate.evidenceType,
      })) {
      return candidate;
    }
    return {
      ...candidate,
      rejectionReason: COMPLEMENTARY_ALIGNMENT_REJECTION,
    };
  });
}

function classifyEvidenceType(span: EvidenceSpan): { evidenceType: EvidenceType; rejectionReason: string | null } {
  const text = normalizeText(span.text);
  if (span.reliability === "excluded" || span.noise?.length
    || /(?:…|\.\.\.|\[\s*(?:truncated|continued|omitted)\s*\])/i.test(span.text)) {
    return { evidenceType: "incomplete_or_noisy", rejectionReason: "The source span is truncated, stitched, or marked as noisy/limited evidence." };
  }

  const implementationLanguage = /\b(?:measured|calculated|quantified|implemented|monitored|recorded|surveyed|mapped|sampled|collected|analysed|analyzed|determined|estimated|verified|documented|qualifies|eligible|authorized|authorised|reduces|spans?|follows|implement)\b/.test(text);
  const descriptiveProjectContext = hasProjectSpecificMarkers(text)
    || /\bmonitoring plan\b/i.test(text);
  const descriptiveProjectImplementation = /\b(?:describ\w*|defin\w*|address\w*)\b/.test(text)
    && descriptiveProjectContext
    && !/\b(?:will be|to be|pending|future|not yet|shall|must)\b/.test(text)
    && hasDescriptiveImplementationDetails(text)
    && (!/\b(?:module|modules|tool|tools)\b/.test(text) || implementationLanguage);
  const moduleDeclaration = /\b(?:module|modules|tool|tools)\b/.test(text)
    && !implementationLanguage
    && !descriptiveProjectImplementation
    && !/\b(?:input|variable|parameter|baseline|leakage|monitoring|calculation|result|equation)\b/.test(text)
    && !hasExplicitScopeExclusion(text);
  if (moduleDeclaration) {
    return { evidenceType: "module_or_tool_declaration", rejectionReason: "A module or tool declaration shows pathway selection, not completed project implementation." };
  }

  const explicitScopeExclusion = /\b(?:not arr|not ifm|not wrc|no peat(?:land)?|no tidal|no wetland|no arr|no ifm|does not include|excluded|redd[-/ ]?(?:apd|only)|upland forest only)\b/.test(text)
    && /\b(?:project|project area|project activity|project scope|properties|activity)\b/.test(text);
  if (explicitScopeExclusion) {
    return { evidenceType: "project_specific_scope", rejectionReason: null };
  }

  const methodologyOnly = /\b(?:methodology|module|tool|template|standard|must|shall|required|applicability conditions?)\b/.test(text)
    && !hasProjectSpecificMarkers(text);
  if (methodologyOnly || candidateLooksLikeBoilerplate({
    rule: { id: "", title: "", summary: "", type: "" },
    contract: {
      id: "", label: "", methodologyId: "", rulebookVersion: "", pddSectionsToSearch: [],
      strongEvidenceSignals: [], weakEvidenceSignals: [], rejectSignals: [], notApplicableSignals: [],
      defaultGapMessage: "", clientAction: "", supportsNotApplicable: false,
    },
    candidate: { span, sectionTitle: null, score: 0, strongHits: 0, signalTokenHits: 0, weakHits: 0, rejectHits: 0, ruleHits: 0, sectionHits: 0, projectFactBonus: 0, evidenceType: "methodology_boilerplate", rejectionReason: null },
  })) {
    return { evidenceType: "methodology_boilerplate", rejectionReason: "The source span contains copied methodology or requirement language without project-specific implementation facts." };
  }

  const scopeLanguage = /\b(?:project area|project scope|project activity|applies|applicable|not applicable|excluded|excludes|does not include|no peat|no tidal|no wetland|not peat|not tidal|not wetland)\b/.test(text);
  if (scopeLanguage && !implementationLanguage && !descriptiveProjectImplementation) {
    return { evidenceType: "project_specific_scope", rejectionReason: null };
  }
  const acceptedImplementationContext = hasProjectSpecificMarkers(text)
    || /\bthe project\b/.test(text)
    || (
      descriptiveProjectImplementation
      && /\bmonitoring plan\b/i.test(text)
    );
  if (acceptedImplementationContext
    && (implementationLanguage || descriptiveProjectImplementation)) {
    return { evidenceType: "project_specific_implementation", rejectionReason: null };
  }
  return { evidenceType: "incomplete_or_noisy", rejectionReason: "The span is relevant by keywords but does not contain enough project-specific evidence." };
}

function hasExplicitScopeExclusion(text: string): boolean {
  return (/\b(?:not arr|not ifm|not wrc|no peat(?:land)?|no tidal|no wetland|no arr|no ifm|does not include|excluded|redd[-/ ]?(?:apd|only)|upland forest only)\b/.test(text)
    || /\bnot applicable\b/.test(text))
    && /\b(?:project|project area|project activity|project scope|properties|activity)\b/.test(text);
}

function explicitScopeExclusionFragments(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((fragment) => normalizeText(fragment))
    .filter((fragment) => hasExplicitScopeExclusion(fragment));
}

const APPLICABILITY_SUBJECT_STOPWORDS = new Set([
  "apply",
  "applies",
  "applicable",
  "exclude",
  "excluded",
  "excludes",
  "excluding",
  "exclusion",
  "include",
  "included",
  "includes",
  "including",
  "inclusion",
  "inclusion/exclusion",
  "scope",
]);

function applicabilitySubjectTokens(
  rule: MethodologyEvidenceAuditRule,
  contract: MethodologyEvidenceContract,
): string[] {
  return tokenize([
    rule.summary ?? "",
    resolveRuleLogic(rule),
    contract.label,
    contract.appliesToFamily ?? "",
  ].join(" "), TEXT_STOPWORDS).filter((token) =>
    !/^(?:verra|afolu|vm\d+|v\d|r-\d)/.test(token)
    && token !== "table"
    && !APPLICABILITY_SUBJECT_STOPWORDS.has(token),
  );
}

function hasApplicabilitySubjectAlignment(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  text: string;
}): boolean {
  const subjectTokens = applicabilitySubjectTokens(input.rule, input.contract);
  if (subjectTokens.length === 0) return false;
  const fragments = explicitScopeExclusionFragments(input.text);
  return fragments.some((fragment) => {
    const fragmentTokens = tokenize(fragment, TEXT_STOPWORDS);
    return subjectTokens.some((subjectToken) => fragmentTokens.some((fragmentToken) =>
      subjectToken === fragmentToken
      || (Math.min(subjectToken.length, fragmentToken.length) >= 4
        && (subjectToken.startsWith(fragmentToken) || fragmentToken.startsWith(subjectToken))),
    ));
  });
}

function isAcceptedProjectEvidence(candidate: CandidateScore): boolean {
  return (candidate.evidenceType === "project_specific_implementation"
    || candidate.evidenceType === "project_specific_scope")
    && candidate.rejectionReason === null;
}

function isAcceptedScopeEvidence(candidate: CandidateScore): boolean {
  if (!isAcceptedProjectEvidence(candidate) || candidate.evidenceType === "project_specific_implementation") return false;
  const text = normalizeText(candidate.span.text);
  return hasExplicitScopeExclusion(text)
    || hasProjectSpecificMarkers(text)
    || /\b(?:the project|project area|project activity|project scope)\b/.test(text);
}

function mandatoryComponentCoverage(
  contract: MethodologyEvidenceContract,
  candidates: readonly CandidateScore[],
): { supported: string[]; missing: string[] } {
  const projectCandidates = candidates.filter((candidate) => candidate.evidenceType === "project_specific_implementation"
    && candidate.span.text.length <= 3000
    && !/\bccb\s*&\s*vcs project description template\b/i.test(candidate.span.text)
    && (candidate.span.text.match(/\bmodules?\b/gi)?.length ?? 0) < 3
    && !/\b(?:methodology|template|tool)\b/i.test(candidate.span.text));
  const supported = (contract.mandatoryComponents ?? [])
    .filter((component) => projectCandidates.some((candidate) =>
      component.signals.some((signal) => countEvidenceSignalMatches(candidate.span.text, [signal]) > 0),
    ))
    .map((component) => component.id);
  const supportedSet = new Set(supported);
  return {
    supported,
    missing: (contract.mandatoryComponents ?? []).filter((component) => !supportedSet.has(component.id)).map((component) => component.id),
  };
}

function methodologyBoilerplatePenalty(text: string): number {
  // A project-specific span may legitimately quote a methodology condition and
  // then provide the project's justification. Penalize copied-only spans, not
  // mixed spans where the project facts are present for the rule to assess.
  if (hasProjectSpecificMarkers(text)) return 0;

  const methodologySignals = [
    /\bmethodolog(?:y|ies)\b/g,
    /\bmodules?\b/g,
    /\btools?\b/g,
    /\btemplates?\b/g,
    /\bstandards?\b/g,
    /\bapplicability conditions?\b/g,
    /\b(?:must|shall|required|as required|in accordance with)\b/g,
  ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

  if (methodologySignals === 0) return 0;
  const densityPenalty = methodologySignals * 6;
  const mixedSpanPenalty = methodologySignals >= 3 && text.length > 600 ? 28 : 0;
  const definitionTablePenalty = /\b(?:VCS Program Definitions|category\s+metric|estimated by the end|internationally accepted definition)\b/i.test(text)
    ? 32
    : 0;
  return densityPenalty + mixedSpanPenalty + definitionTablePenalty;
}

function projectFactBonus(text: string): number {
  if (/\bthe project area qualifies as forest\b/i.test(text)) return 48;
  const factualSignals = [
    /\b(?:project area qualifies|has remained forested|project area is|project area covers)\b/i,
    /\b(?:properties|landowners|municipalities|historical reference period|project start date)\b/i,
    /\b(?:confirm|confirmed|classified|documented|measured|recorded|observed)\b/i,
  ];
  return factualSignals.reduce((bonus, pattern) => bonus + (pattern.test(text) ? 10 : 0), 0);
}

function hasDescriptiveImplementationDetails(text: string): boolean {
  const detailCategories = [
    /\b(?:community agreements?|controls?|safeguards?|management procedures?)\b/i,
    /\b(?:surveillance|sampling design|plot remeasurement|measurements?|observations?)\b/i,
    /\b(?:qa\s*\/\s*qc checks?|reporting workflow|recordkeeping|records?|workflow)\b/i,
  ];

  return alignmentFragments(text).some((fragment) => {
    const hasCurrentAction = /\b(?:describ\w*|defin\w*|address\w*)\b/i.test(fragment);
    const hasLocalProjectContext = hasProjectSpecificMarkers(fragment)
      || /\bmonitoring plan\b/i.test(fragment);
    const hasMethodologyOnlyLanguage = /\b(?:methodology|template|standard|shall|must|required|applicability conditions?)\b/i.test(fragment);
    const detailCount = detailCategories.filter((pattern) => pattern.test(fragment)).length;
    return hasCurrentAction
      && hasLocalProjectContext
      && !hasMethodologyOnlyLanguage
      && detailCount >= 2;
  });
}

function evidenceSpecificityBonus(text: string): number {
  const normalized = normalizeText(text);
  const lengthBonus = normalized.length <= 420 ? 8 : normalized.length <= 900 ? 4 : 0;
  const explicitScopeBonus = /\b(?:no|not|without|excludes?|excluded|does not include|is not)\b/.test(normalized)
    && /\b(?:peat|tidal|wetland|arr|ifm|wrc|soil|deforest|scope|activity|project)\b/.test(normalized)
    ? 18
    : 0;
  const projectAssertionBonus = /\b(?:the project|project area|project activities|the pdd)\b/.test(normalized)
    && /\b(?:is|are|has|have|includes?|excludes?|occurs?|occurring|qualifies|confirms?|states?)\b/.test(normalized)
    ? 12
    : 0;
  const quantifiedFactBonus = /\b(?:all|no|at least|approximately)\s+\d+\b/.test(normalized)
    || /\b(?:there are no|does not include|is not present|are not present)\b/.test(normalized)
    ? 20
    : 0;
  const eligibilityFactBonus = /\b(?:the project|project area)\b[\s\S]{0,120}\b(?:eligible|qualifies as forest|has remained forested)\b/.test(normalized)
    ? 40
    : 0;
  const applicabilityFactBonus = /\b(?:category|condition|module|rule)\b[\s\S]{0,100}\b(?:is|are)\s+(?:not\s+)?applicable\b/.test(normalized)
    && /\b(?:project|properties|area|activity)\b/.test(normalized)
    ? 60
    : 0;
  const copiedTextPenalty = /\b(?:methodology|module|tool|template|standard)\b/.test(normalized)
    && !hasProjectSpecificMarkers(normalized)
    ? 18
    : 0;
  const pendingPenalty = /\b(?:will be|to be|provided during|proxy|pending|not yet|under development|future)\b/.test(normalized)
    || /\bnot required at the .* stage\b/.test(normalized)
    ? 40
    : 0;
  return lengthBonus + explicitScopeBonus + projectAssertionBonus + quantifiedFactBonus + eligibilityFactBonus + applicabilityFactBonus - copiedTextPenalty - pendingPenalty;
}

function candidateLooksLikeBoilerplate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  candidate: CandidateScore | null;
}): boolean {
  if (!input.candidate) return false;
  const candidateText = normalizeText(input.candidate.span.text);
  const candidateTokens = tokenize(candidateText, TEXT_STOPWORDS);
  const ruleTokens = deriveRuleTokens(input.rule);
  const signalTokens = tokenize(deriveContractSignalPhrases(input.contract).join(" "), TEXT_STOPWORDS);

  const overlapWithRule = intersectionCount(candidateTokens, ruleTokens);
  const overlapWithSignals = intersectionCount(candidateTokens, signalTokens);
  const overlapRatio = ruleTokens.length > 0 ? overlapWithRule / ruleTokens.length : 0;
  const methodologyVoice =
    /\b(must|shall|mandatory|required|is determined via|is additional because|in the absence of the project activity)\b/.test(candidateText);
  const methodologyOrModuleOnly = /\b(methodology|module|tool|template|standard)\b/.test(candidateText)
    && !hasProjectSpecificMarkers(candidateText);

  return !hasProjectSpecificMarkers(candidateText)
    && (overlapRatio >= 0.45 || (overlapWithRule >= 4 && overlapWithSignals >= 2) || methodologyVoice || methodologyOrModuleOnly);
}

function candidateDescribesFutureOrUnissuedEvidence(input: {
  rule: MethodologyEvidenceAuditRule;
  candidate: CandidateScore;
}): boolean {
  const text = normalizeText(input.candidate.span.text);
  const futureWork = /\b(will be|to be|shall be|provided during|during the validation stage|future|under development|not yet available|not required at the .* stage)\b/.test(text);
  const authorizationRule = /\b(permit|permission|authorization|authorisation|license|licence|approval|legal right|legally authorized|legally authorised)\b/.test(
    normalizeText(`${resolveRuleTitle(input.rule)} ${resolveRuleLogic(input.rule)}`),
  );
  const filedButNotIssued = authorizationRule
    && /\b(filed|application|applied for|request(?:ed)?|pending)\b/.test(text)
    && !/\b(issued|granted|approved|authorized|authorised|permit number|license number|licence number)\b/.test(text);
  return futureWork || filedButNotIssued;
}

function deriveScopeKeywords(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): string[] {
  const seed = [
    resolveRuleTitle(rule),
    resolveRuleLogic(rule),
    contract.label,
    contract.appliesToFamily ?? "",
    ...contract.notApplicableSignals,
  ].join(" ");
  return tokenize(seed, TEXT_STOPWORDS);
}

function requiresScopeSpecificEvidence(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): boolean {
  if (!contract.supportsNotApplicable) return false;
  const scopeKeywords = deriveScopeKeywords(rule, contract);
  return scopeKeywords.length > 0;
}

function hasScopeEvidence(candidate: CandidateScore | null, scopeKeywords: readonly string[]): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return scopeKeywords.some((keyword) => keyword.length > 4 && text.includes(keyword))
    && /\b(?:applicable|applies|not applicable|excluded|excludes|does not include|no peat|no tidal|no wetland|scope|activity)\b/.test(text);
}

function hasAmbiguousScopeLanguage(candidate: CandidateScore | null): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return includesPhrase(text, "does not say whether")
    || includesPhrase(text, "not clear whether")
    || includesPhrase(text, "unclear whether")
    || includesPhrase(text, "not specified whether");
}

function buildRelevantSectionIds(input: {
  contract: MethodologyEvidenceContract;
  rule: MethodologyEvidenceAuditRule;
  sections: readonly SectionLike[] | undefined;
}): Set<string> {
  const relevant = new Set<string>();
  const sectionSignals = deriveSectionSignals(input.contract);
  const sectionTokens = deriveSectionTokens(input.contract, input.rule);

  for (const section of input.sections ?? []) {
    const title = normalizeText(section.titleClean || section.titleRaw);
    const body = normalizeText(section.bodyClean || section.bodyRaw);
    const titleHit = countPhraseHits(title, sectionSignals);
    const tokenHit = countTokenHits(title, sectionTokens);
    const bodyHit = countPhraseHits(body, sectionSignals);
    if (titleHit > 0 || tokenHit > 0 || bodyHit > 0) {
      relevant.add(section.id);
    }
  }

  return relevant;
}

function candidateScore(input: {
  span: EvidenceSpan;
  sectionTitle: string | null;
  contract: MethodologyEvidenceContract;
  rule: MethodologyEvidenceAuditRule;
  preferredSectionIds: Set<string>;
}): CandidateScore | null {
  if (input.span.reliability === "excluded") return null;

  const text = normalizeText(input.span.text);
  if (!text || text.length < 20) return null;

  const sectionLabel = normalizeText(
    input.sectionTitle || input.span.heading || input.span.sectionPath[input.span.sectionPath.length - 1],
  );
  const ruleTokens = deriveRuleTokens(input.rule);
  const sectionTokens = deriveSectionTokens(input.contract, input.rule);
  const signalPhrases = deriveContractSignalPhrases(input.contract);

  const sectionHits = countPhraseHits(sectionLabel, deriveSectionSignals(input.contract))
    + countTokenHits(sectionLabel, sectionTokens);
  const ruleHits = countTokenHits(text, ruleTokens);
  // A token overlap with a natural-language signal is useful for retrieval, but
  // it is not evidence that the signal's complete requirement is satisfied.
  // Keep phrase matches separate so aggregate keyword overlap cannot promote a
  // partial or methodology-only span to full support.
  // Keep ranking tied to explicit contract phrases. Broader normalized/synonym
  // matching is applied only when evaluating component/support coverage so it
  // cannot reorder the diagnostic candidate set around incidental keywords.
  const strongHits = countPhraseHits(text, input.contract.strongEvidenceSignals);
  const signalTokenHits = Math.min(countTokenHits(text, tokenize(signalPhrases.join(" "), TEXT_STOPWORDS)), 4);
  const weakHits = countPhraseHits(text, input.contract.weakEvidenceSignals);
  const rejectHits = countPhraseHits(text, input.contract.rejectSignals);
  const boilerplatePenalty = methodologyBoilerplatePenalty(text);
  const projectFactBonusValue = projectFactBonus(text);

  const preferredSectionBonus = input.span.sectionId && input.preferredSectionIds.has(input.span.sectionId) ? 20 : 0;
  const reliabilityBonus = input.span.reliability === "primary" ? 6 : -2;
  const headingPenalty = input.span.blockType === "section_heading" ? 14 : 0;
  const noisePenalty = input.span.noise?.length ? 10 : 0;
  const specificityBonus = evidenceSpecificityBonus(text);
  const classifiedEvidence = classifyEvidenceType(input.span);

  const score =
    preferredSectionBonus
    + (sectionHits * 8)
    // Rule-token overlap is useful for recall, but should not outweigh a
    // complete project-specific signal or a scope/exclusion statement.
    + (ruleHits * 3)
    + (strongHits * 9)
    + (signalTokenHits * 2)
    + (weakHits * 3)
    // Explicit project qualification language is a stronger retrieval signal
    // than generic methodology vocabulary.
    + (ruleTokens.includes("forest") && /\bthe project area qualifies as forest\b/i.test(text) ? 30 : 0)
    + specificityBonus
    // Project markers are retained for classification diagnostics, but broad
    // factual language must not outweigh rule-specific evidence during retrieval.
    + reliabilityBonus
    - (rejectHits * 12)
    - headingPenalty
    - noisePenalty
    - boilerplatePenalty;

  if (score <= 0 && strongHits === 0 && ruleHits === 0 && sectionHits === 0) return null;

  return {
    span: input.span,
    sectionTitle: input.sectionTitle,
    score,
    strongHits,
    signalTokenHits,
    weakHits,
    rejectHits,
    ruleHits,
    sectionHits,
    projectFactBonus: projectFactBonusValue,
    evidenceType: classifiedEvidence.evidenceType,
    rejectionReason: classifiedEvidence.rejectionReason,
  };
}

function selectBestCandidate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}): CandidateScore | null {
  const prioritized = scoreCandidates(input, "best");
  let best: CandidateScore | null = null;
  for (const candidate of prioritized) {
    // Preserve the pre-trace behavior: preferred-section ordering is the
    // first tie-breaker, and equal scores retain the first span encountered.
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function scoreCandidates(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}, order: "best" | "evidence"): CandidateScore[] {
  const sectionLookup = buildSectionLookup(input.sections);
  const preferredSectionIds = buildRelevantSectionIds({
    contract: input.contract,
    rule: input.rule,
    sections: input.sections,
  });

  const prioritized = input.evidenceDocument.spans.filter((span) => !span.noise?.includes("toc"));
  if (order === "best") {
    prioritized.sort((a, b) => {
      const aPreferred = a.sectionId && preferredSectionIds.has(a.sectionId) ? 1 : 0;
      const bPreferred = b.sectionId && preferredSectionIds.has(b.sectionId) ? 1 : 0;
      return bPreferred - aPreferred;
    });
  }

  const candidates: CandidateScore[] = [];
  for (const span of prioritized) {
    const sectionTitle = span.sectionId
      ? (sectionLookup.get(span.sectionId)?.titleClean || sectionLookup.get(span.sectionId)?.titleRaw || null)
      : null;
    const scored = candidateScore({
      span,
      sectionTitle,
      contract: input.contract,
      rule: input.rule,
      preferredSectionIds,
    });
    if (!scored) continue;
    candidates.push(scored);
  }
  return candidates;
}

function selectEvidenceCandidates(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
  bestCandidate: CandidateScore;
}): CandidateScore[] {
  const scored = scoreCandidates(input, "evidence")
    .filter((candidate) =>
      // Keep complementary project evidence when the document distributes a
      // rule's support across sections; the top span still controls status.
      candidate.score >= Math.max(24, input.bestCandidate.score - 40)
      || (candidate.projectFactBonus >= 10 && candidate.strongHits >= 1)
    )
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;
      if (left.span.spanId === input.bestCandidate.span.spanId) return -1;
      if (right.span.spanId === input.bestCandidate.span.spanId) return 1;
      return 0;
    });

  const seen = new Set<string>();
  return scored.filter((candidate) => {
    if (seen.has(candidate.span.spanId)) return false;
    seen.add(candidate.span.spanId);
    return true;
  }).slice(0, 6);
}

function diagnosticCandidate(candidate: CandidateScore): EvidenceAuditDiagnosticCandidate {
  return {
    spanId: candidate.span.spanId,
    quote: sourceQuote(candidate.span.text),
    page: candidate.span.page,
    score: candidate.score,
    evidenceType: candidate.evidenceType,
    rejectionReason: candidate.rejectionReason,
  };
}

function selectNotApplicableCandidate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}): CandidateScore | null {
  if (!isNotApplicableEligible(input.rule, input.contract)) return null;

  const sectionLookup = buildSectionLookup(input.sections);
  const applicability = input.contract.applicability;
  const naPhrases = Array.from(new Set(applicability?.exclusionSignals ?? input.contract.notApplicableSignals));
  const contextPhrases = Array.from(new Set(applicability?.contextSignals ?? []));
  if (!naPhrases.length) return null;

  let best: CandidateScore | null = null;
  for (const span of input.evidenceDocument.spans) {
    const text = normalizeText(span.text);
    if (!text || span.reliability === "excluded") continue;
    const phraseHits = countPhraseHits(text, naPhrases);
    const contextHits = contextPhrases.length === 0 ? 1 : countPhraseHits(text, contextPhrases);
    const hasProjectContext = hasProjectSpecificMarkers(text) || hasExplicitScopeExclusion(text);
    if (applicability && (contextHits === 0 || (applicability.requireProjectSpecificContext && !hasProjectContext))) continue;
    const signalOverlap = intersectionCount(tokenize(text, TEXT_STOPWORDS), tokenize(naPhrases.join(" "), TEXT_STOPWORDS));
    if (applicability?.requireRuleSubjectAlignment
      && !hasApplicabilitySubjectAlignment({ rule: input.rule, contract: input.contract, text: span.text })) continue;
    if (phraseHits === 0 && (!hasExplicitScopeExclusion(text) || signalOverlap < 2)) continue;

    const sectionTitle = span.sectionId
      ? (sectionLookup.get(span.sectionId)?.titleClean || sectionLookup.get(span.sectionId)?.titleRaw || null)
      : null;

    const score = Math.max(1, phraseHits) * 14
      + (span.reliability === "primary" ? 6 : 0)
      + evidenceSpecificityBonus(text);
    const candidate: CandidateScore = {
      span,
      sectionTitle,
      score,
      strongHits: phraseHits,
      signalTokenHits: phraseHits,
      weakHits: 0,
      rejectHits: 0,
      ruleHits: 0,
      sectionHits: 0,
      projectFactBonus: 0,
      evidenceType: classifyEvidenceType(span).evidenceType,
      rejectionReason: classifyEvidenceType(span).rejectionReason,
    };
    if (applicability && phraseHits > 0 && contextHits > 0 && hasProjectContext
      && candidate.evidenceType !== "methodology_boilerplate"
      && candidate.evidenceType !== "incomplete_or_noisy"
      && candidate.evidenceType !== "module_or_tool_declaration") {
      candidate.evidenceType = "project_specific_scope";
      candidate.rejectionReason = null;
    }
    if (!isAcceptedScopeEvidence(candidate)) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (!best) return null;

  return hasAmbiguousScopeLanguage(best) ? null : best;
}

function classifyStatus(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  bestCandidate: CandidateScore | null;
  notApplicableCandidate: CandidateScore | null;
  evidenceCandidates: readonly CandidateScore[];
}): {
  status: EvidenceAuditStatus;
  confidence: EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
  componentCoverage?: { supported: readonly string[]; missing: readonly string[] };
} {
  if (input.notApplicableCandidate) {
    return {
      status: "not_applicable",
      confidence: input.notApplicableCandidate.score >= 24 ? "high" : "medium",
      assessmentReason: "The PDD contains project-specific scope language showing this rule does not apply to the project.",
      gap: "",
    };
  }

  const scopeKeywords = deriveScopeKeywords(input.rule, input.contract);
  const scopeCandidate = input.evidenceCandidates
    .filter(isAcceptedProjectEvidence)
    .find((candidate) => hasScopeEvidence(candidate, scopeKeywords))
    ?? null;
  if (
    requiresScopeSpecificEvidence(input.rule, input.contract)
    && (!scopeCandidate || hasAmbiguousScopeLanguage(scopeCandidate))
  ) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "This scope-sensitive rule needs project-specific evidence showing why it applies or does not apply, and the PDD does not show that clearly.",
      gap: input.contract.defaultGapMessage,
    };
  }

  const acceptedCandidates = input.evidenceCandidates.filter(isAcceptedProjectEvidence);
  const assessmentCandidate = input.bestCandidate && isAcceptedProjectEvidence(input.bestCandidate)
    ? input.bestCandidate
    : [...acceptedCandidates].sort((left, right) => right.score - left.score)[0] ?? input.bestCandidate;

  if (candidateLooksLikeBoilerplate({
    rule: input.rule,
    contract: input.contract,
    candidate: assessmentCandidate,
  })) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "The strongest matching span reads like methodology boilerplate or copied rule text rather than project-specific PDD evidence.",
      gap: input.contract.defaultGapMessage,
    };
  }

  if (assessmentCandidate) {
    if (!isAcceptedProjectEvidence(assessmentCandidate)) {
      return {
        status: assessmentCandidate.evidenceType === "incomplete_or_noisy"
          && assessmentCandidate.strongHits === 0
          && assessmentCandidate.weakHits === 0
          ? "missing_evidence"
          : "partially_supported",
        confidence: "low",
        assessmentReason: assessmentCandidate.rejectionReason ?? "The selected evidence type cannot prove completed project implementation.",
        gap: input.contract.defaultGapMessage,
      };
    }

    if (candidateDescribesFutureOrUnissuedEvidence({ rule: input.rule, candidate: assessmentCandidate })) {
      return {
        status: "partially_supported",
        confidence: "low",
        assessmentReason: "The selected span describes planned future work or an unissued application, so it cannot be treated as completed project evidence.",
        gap: input.contract.defaultGapMessage,
      };
    }

    if (assessmentCandidate.rejectHits > 0 && assessmentCandidate.strongHits === 0) {
      return {
        status: "manual_review_needed",
        confidence: "low",
        assessmentReason: "The best matching span appears relevant but reads too much like boilerplate or conflicting rule text to rely on automatically.",
        gap: input.contract.defaultGapMessage,
      };
    }

    const componentCoverage = mandatoryComponentCoverage(input.contract, acceptedCandidates);
    if (componentCoverage.missing.length > 0) {
      return {
        status: componentCoverage.supported.length > 0 ? "partially_supported" : "missing_evidence",
        confidence: "low",
        assessmentReason: `Project-specific evidence is incomplete: missing mandatory components ${componentCoverage.missing.join(", ")}.`,
        gap: input.contract.defaultGapMessage,
        componentCoverage,
      };
    }

    if ((input.contract.mandatoryComponents?.length ?? 0) > 0
      && componentCoverage.missing.length === 0
      && assessmentCandidate.evidenceType === "project_specific_implementation") {
      return {
        status: "supported_by_pdd",
        confidence: "high",
        assessmentReason: "All mandatory evidence components are supported by project-specific implementation evidence.",
        gap: "",
        componentCoverage,
      };
    }

    if (
      assessmentCandidate.evidenceType === "project_specific_implementation"
      && assessmentCandidate.strongHits >= 2
      && assessmentCandidate.projectFactBonus >= 10
      || (
        (input.contract.id === "family:redd-eligibility"
          || (input.contract.appliesToRuleIds?.length ?? 0) > 0)
        && assessmentCandidate.projectFactBonus >= 48
        && assessmentCandidate.ruleHits >= 5
        && assessmentCandidate.signalTokenHits >= 2
      )
      || (
        (input.contract.appliesToRuleIds?.length ?? 0) > 0
        && assessmentCandidate.evidenceType === "project_specific_implementation"
        && assessmentCandidate.strongHits >= 1
      )
    ) {
      return {
        status: "supported_by_pdd",
        confidence: assessmentCandidate.score >= 56 ? "high" : "medium",
        assessmentReason: "The selected PDD span contains project-specific language that aligns well with the rule logic and contract evidence signals.",
        gap: "",
        componentCoverage,
      };
    }

    // Some contracts express their signals as prose rather than reusable
    // phrases. A dense, project-specific overlap can support the legacy path,
    // but a single shared keyword cannot.
    if (assessmentCandidate.evidenceType === "project_specific_implementation"
      && assessmentCandidate.ruleHits >= 8
      && assessmentCandidate.signalTokenHits >= 2) {
      return {
        status: "supported_by_pdd",
        confidence: "medium",
        assessmentReason: "The selected PDD span contains dense project-specific implementation facts matching the contract vocabulary.",
        gap: "",
        componentCoverage,
      };
    }

    if (assessmentCandidate.strongHits >= 1 || assessmentCandidate.weakHits >= 1 || assessmentCandidate.score >= 24) {
      return {
        status: "partially_supported",
        confidence: "medium",
        assessmentReason: "The PDD contains a relevant span for this rule, but it does not fully cover the evidence expected by the contract.",
        gap: input.contract.defaultGapMessage,
        componentCoverage,
      };
    }

    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "The PDD contains a possible match, but the evidence is too weak or ambiguous to classify confidently.",
      gap: input.contract.defaultGapMessage,
      componentCoverage,
    };
  }

  if (isNotApplicableEligible(input.rule, input.contract)) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "This rule could be not applicable, but the PDD does not clearly support that scope decision.",
      gap: input.contract.defaultGapMessage,
    };
  }

  return {
    status: "missing_evidence",
    confidence: "low",
    assessmentReason: "No clear PDD span matched the rule logic and the contract’s evidence expectations.",
    gap: input.contract.defaultGapMessage,
  };
}

function reasonSelected(input: {
  candidate: CandidateScore | null;
  status: EvidenceAuditStatus;
}): string {
  if (!input.candidate) {
    return input.status === "missing_evidence"
      ? "No candidate evidence span cleared the minimum relevance threshold."
      : "No candidate span was strong enough to justify an automatic scope decision.";
  }

  return `Selected the highest-scoring span with sectionHits=${input.candidate.sectionHits}, ruleHits=${input.candidate.ruleHits}, strongHits=${input.candidate.strongHits}, weakHits=${input.candidate.weakHits}.`;
}

function resultFromCandidate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  versionLock: MethodologyVersionLock;
  candidate: CandidateScore | null;
  evidenceCandidates?: readonly CandidateScore[];
  status: EvidenceAuditStatus;
  confidence: EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
  componentCoverage?: { supported: readonly string[]; missing: readonly string[] };
  normalizeRuleId?: (ruleId: string) => string;
}): MethodologyEvidenceAuditResult {
  const acceptedEvidenceCandidates = (input.evidenceCandidates ?? []).filter(isAcceptedProjectEvidence);
  const rejectedEvidenceCandidates = (input.evidenceCandidates ?? []).filter((candidate) => !isAcceptedProjectEvidence(candidate));
  const acceptedCandidate = input.status === "missing_evidence"
    ? null
    : acceptedEvidenceCandidates[0] ?? (input.candidate && isAcceptedProjectEvidence(input.candidate) ? input.candidate : null);
  const provenanceCandidate = acceptedCandidate;
  const sectionLabel = provenanceCandidate?.sectionTitle
    || provenanceCandidate?.span.heading
    || provenanceCandidate?.span.sectionId
    || null;

  return {
    ruleId: normalizeRuleId(input.rule.id, input.normalizeRuleId),
    stableId: resolveStableId(input.rule),
    title: resolveRuleTitle(input.rule),
    ruleLogic: resolveRuleLogic(input.rule),
    methodologyId: input.versionLock.methodologyId,
    rulebookVersionRaw: input.versionLock.rulebookVersionRaw,
    rulebookVersionKey: input.versionLock.rulebookVersionKey,
    rulebookVersion: input.versionLock.rulebookVersion,
    pddDeclaredMethodologyVersionRaw: input.versionLock.pddDeclaredMethodologyVersionRaw,
    pddDeclaredMethodologyVersion: input.versionLock.pddDeclaredMethodologyVersion,
    versionMatch: input.versionLock.versionMatch,
    versionMismatchReason: input.versionLock.versionMismatchReason,
    userAcceptedVersionWarning: input.versionLock.userAcceptedVersionWarning,
    status: input.status,
    bestEvidenceQuote: acceptedCandidate ? sourceQuote(acceptedCandidate.span.text) : null,
    evidence: input.status === "missing_evidence" ? [] : acceptedEvidenceCandidates.map((candidate) => ({
      quote: sourceQuote(candidate.span.text),
      page: candidate.span.page,
      section: candidate.sectionTitle || candidate.span.heading || candidate.span.sectionId || null,
      span: candidate.span.spanId,
      evidenceType: candidate.evidenceType,
      rejectionReason: candidate.rejectionReason ?? undefined,
    })),
    rejectedEvidence: [...rejectedEvidenceCandidates, ...(input.candidate && !isAcceptedProjectEvidence(input.candidate) ? [input.candidate] : [])]
      .filter((candidate, index, all) => all.findIndex((other) => other.span.spanId === candidate.span.spanId) === index)
      .map((candidate) => ({
        quote: sourceQuote(candidate.span.text),
        page: candidate.span.page,
        section: candidate.sectionTitle || candidate.span.heading || candidate.span.sectionId || null,
        span: candidate.span.spanId,
        evidenceType: candidate.evidenceType,
        rejectionReason: candidate.rejectionReason ?? "Candidate was not accepted as sufficient evidence.",
      })),
    ...(input.componentCoverage && (input.contract.mandatoryComponents?.length ?? 0) > 0
      ? { supportedComponents: input.componentCoverage.supported, missingComponents: input.componentCoverage.missing }
      : {}),
    page: provenanceCandidate?.span.page ?? null,
    section: sectionLabel,
    span: provenanceCandidate?.span.spanId ?? null,
    reasonSelected: reasonSelected({ candidate: input.candidate, status: input.status }),
    assessmentReason: input.assessmentReason,
    gap: input.gap,
    clientAction: input.contract.clientAction,
    confidence: input.confidence,
  };
}

export function auditEvidence(input: MethodologyEvidenceAuditInput): MethodologyEvidenceAuditSummary {
  const versionLock = resolveAuditVersionLock(input);
  const userAcceptedVersionWarning = Boolean(input.userAcceptedVersionWarning);
  if (!versionLock.versionMatch) {
    return {
      auditStatus: "BLOCKED_VERSION_MISMATCH",
      methodologyId: versionLock.methodologyId,
      rulebookVersionRaw: versionLock.rulebookVersionRaw,
      rulebookVersionKey: versionLock.rulebookVersionKey,
      rulebookVersion: versionLock.rulebookVersion,
      pddDeclaredMethodologyVersionRaw: versionLock.pddDeclaredMethodologyVersionRaw,
      pddDeclaredMethodologyVersion: versionLock.pddDeclaredMethodologyVersion,
      versionMatch: false,
      versionMismatchReason: versionLock.versionMismatchReason,
      userAcceptedVersionWarning,
      results: [],
      totals: {
        supported_by_pdd: 0,
        partially_supported: 0,
        missing_evidence: 0,
        not_applicable: 0,
        manual_review_needed: 0,
      },
      totalRules: input.rules.length,
    };
  }

  const auditStatus = "AUDITED";

  const diagnosticTrace: EvidenceAuditDiagnosticTrace[] = [];
  const results = input.rules.map((rule) => {
    const contract = input.getContract(rule);
    const bestCandidate = selectBestCandidate({
      rule,
      contract,
      evidenceDocument: input.evidenceDocument,
      sections: input.sections,
    });
    const notApplicableCandidate = selectNotApplicableCandidate({
      rule,
      contract,
      evidenceDocument: input.evidenceDocument,
      sections: input.sections,
    });
    const retrievedEvidenceCandidates = bestCandidate
      ? selectEvidenceCandidates({ rule, contract, evidenceDocument: input.evidenceDocument, sections: input.sections, bestCandidate })
      : [];
    const evidenceCandidates = bestCandidate
      ? applyComplementaryAlignmentGate({
        rule,
        contract,
        bestCandidate,
        candidates: retrievedEvidenceCandidates,
      })
      : [];
    if (input.diagnosticTrace) {
      const retrievalCandidates = scoreCandidates({ rule, contract, evidenceDocument: input.evidenceDocument, sections: input.sections }, "evidence");
      const postFilterCandidates = bestCandidate
        ? retrievalCandidates.filter((candidate) => candidate.score >= Math.max(24, bestCandidate.score - 40) || (candidate.projectFactBonus >= 10 && candidate.strongHits >= 1))
        : [];
      diagnosticTrace.push({
        stableId: resolveStableId(rule),
        retrievalCandidates: retrievalCandidates.map(diagnosticCandidate),
        postFilterCandidates: postFilterCandidates.map(diagnosticCandidate),
        selectedCandidates: evidenceCandidates.map(diagnosticCandidate),
        cutoffPosition: 6,
      });
    }
    const classified = classifyStatus({
      rule,
      contract,
      bestCandidate,
      notApplicableCandidate,
      evidenceCandidates,
    });
    const candidate = classified.status === "not_applicable" ? notApplicableCandidate : bestCandidate;
    const selectedEvidenceCandidates = classified.status === "not_applicable" && candidate
      ? [candidate]
      : evidenceCandidates;

    return resultFromCandidate({
      rule,
      contract,
      versionLock,
      candidate,
      evidenceCandidates: selectedEvidenceCandidates,
      status: classified.status,
      confidence: classified.confidence,
      assessmentReason: classified.assessmentReason,
      gap: classified.gap,
      componentCoverage: classified.componentCoverage,
      normalizeRuleId: input.normalizeRuleId,
    });
  });

  const totals = EVIDENCE_AUDIT_STATUSES.reduce<Record<EvidenceAuditStatus, number>>((acc, status) => {
    acc[status] = results.filter((result) => result.status === status).length;
    return acc;
  }, {
    supported_by_pdd: 0,
    partially_supported: 0,
    missing_evidence: 0,
    not_applicable: 0,
    manual_review_needed: 0,
  });

  return {
    auditStatus,
    methodologyId: versionLock.methodologyId,
    rulebookVersionRaw: versionLock.rulebookVersionRaw,
    rulebookVersionKey: versionLock.rulebookVersionKey,
    rulebookVersion: versionLock.rulebookVersion,
    pddDeclaredMethodologyVersionRaw: versionLock.pddDeclaredMethodologyVersionRaw,
    pddDeclaredMethodologyVersion: versionLock.pddDeclaredMethodologyVersion,
    versionMatch: versionLock.versionMatch,
    versionMismatchReason: versionLock.versionMismatchReason,
    userAcceptedVersionWarning,
    results,
    totals,
    totalRules: input.rules.length,
    ...(input.diagnosticTrace ? { diagnosticTrace } : {}),
  };
}
