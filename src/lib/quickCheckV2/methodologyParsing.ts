import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

export const PRIMARY_METHODOLOGY_CODE_RE =
  /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i;
const GLOBAL_PRIMARY_METHODOLOGY_CODE_RE = new RegExp(PRIMARY_METHODOLOGY_CODE_RE.source, "gi");

const METHODOLOGY_ROW_BOUNDARY_RE = /\b(?:Module|Tool)\b/i;
const LIKELY_ALIAS_RE = /^[A-Z0-9][A-Z0-9+./-]*$/;

export type MethodologyReference = Readonly<{
  methodologyId: string;
  methodologyName: string;
  methodologyAlias: string | null;
  pddDeclaredMethodologyVersion: string | null;
}>;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeDashCharacters(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, "-");
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^[“"'\(\[]+/, "").replace(/[”"'\)\]]+$/, "").trim();
}

function stripTrailingVersionAndApproval(value: string): string {
  const normalized = normalizeDashCharacters(value);
  return normalized
    .replace(/\s*(?:,|\()?\s*(?:version|v)\s*\d+(?:[.-]\d+){0,2}.*$/i, "")
    .replace(/\s*approved.*$/i, "")
    .trim();
}

function stripLeadingMethodologyCode(value: string): string {
  const withoutLabel = normalizeDashCharacters(value).replace(/^(?:Applied(?:\s+Methodology)?|Methodology)\s+/i, "");
  return withoutLabel
    .replace(new RegExp(`^(?:${PRIMARY_METHODOLOGY_CODE_RE.source})(?:\\s*[:\\-–—]?\\s*)+`, "i"), "")
    .trimStart();
}

function isolateMethodologyRowBody(body: string): string {
  const normalized = normalizeWhitespace(normalizeDashCharacters(body));
  const boundary = normalized.match(METHODOLOGY_ROW_BOUNDARY_RE);
  return boundary?.index != null ? normalized.slice(0, boundary.index).trim() : normalized;
}

function isLikelyMethodologyAlias(value: string): boolean {
  return LIKELY_ALIAS_RE.test(value.trim());
}

function findLikelyAliasMatch(body: string): RegExpMatchArray | null {
  const matches = body.matchAll(/\(([^)]+)\)/g);
  for (const match of matches) {
    const candidate = stripWrappingQuotes(normalizeWhitespace(normalizeDashCharacters(match[1] ?? "")));
    if (candidate && isLikelyMethodologyAlias(candidate)) {
      return match;
    }
  }
  return null;
}

function extractVersionFromSegment(segment: string): string | null {
  const normalized = normalizeWhitespace(normalizeDashCharacters(segment));
  // A reference segment starts at the methodology code.  Only accept an
  // explicit version after that code, and stop before module/tool rows.  In
  // particular, never scan the whole selected quote: a cover's "Version
  // 1.3" is document metadata, not a methodology declaration.
  const methodologyScope = normalized.split(METHODOLOGY_ROW_BOUNDARY_RE)[0]!.trim();
  const explicitVersions = [...methodologyScope.matchAll(
    /\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+){0,2})\b/gi,
  )];
  for (const explicitVersion of explicitVersions) {
    const prefix = methodologyScope.slice(0, explicitVersion.index ?? 0);
    if (!PRIMARY_METHODOLOGY_CODE_RE.test(prefix)) continue;
    if (/\b(?:PDD|document|revision|history|template|module|tool)\s*$/i.test(prefix)) continue;
    return normalizeDeclaredMethodologyVersion(explicitVersion[0]);
  }

  const methodologyRowVersion = methodologyScope.match(
    /\bMethodology\s+(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+(?:(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+)?(.+?)\s+([0-9]+(?:[.-][0-9]+){0,2})\b(?=\s+(?:Module|Tool|$))/i,
  );
  if (methodologyRowVersion?.[2]) {
    return normalizeDeclaredMethodologyVersion(methodologyRowVersion[2]);
  }

  const terminalVersionMatches = [...methodologyScope.matchAll(
    /([0-9]+(?:[.-][0-9]+){0,2})(?=\s+(?:Module|Tool|$))/gi,
  )];
  if (terminalVersionMatches[0]?.[1]) {
    return normalizeDeclaredMethodologyVersion(terminalVersionMatches[0][1]);
  }

  const bareTrailingVersion = methodologyScope.match(
    /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4}\s+)?[^.]*?\([^)]+\)\s+([0-9]+(?:[.-][0-9]+){0,2})\s*$/i,
  );
  if (bareTrailingVersion?.[1]) {
    return normalizeDeclaredMethodologyVersion(bareTrailingVersion[1]);
  }

  const plainTrailingVersion = methodologyScope.match(/(?:^|\s)([0-9]+(?:[.-][0-9]+){0,2})\s*$/);
  if (plainTrailingVersion?.[1]) {
    return normalizeDeclaredMethodologyVersion(plainTrailingVersion[1]);
  }

  return null;
}

function extractVersionForMethodologyCode(segment: string, code: string): string | null {
  const normalized = normalizeWhitespace(normalizeDashCharacters(segment));
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowVersionPattern = new RegExp(
    `(?:Applied(?:\\s+Methodology)?|Methodology)\\s+${escapedCode}\\s+(?:${escapedCode}\\s+)?(.+?)\\s+([0-9]+(?:[.-][0-9]+){0,2})`,
    "gi",
  );
  const matches = [...normalized.matchAll(rowVersionPattern)];
  const lastMatch = matches[matches.length - 1];
  if (lastMatch?.[2]) {
    return normalizeDeclaredMethodologyVersion(lastMatch[2]);
  }

  return extractVersionFromSegment(normalized);
}

function extractMethodologyNameFromSegment(segment: string, code: string): string {
  const withoutLeadingCode = stripLeadingMethodologyCode(isolateMethodologyRowBody(segment));
  const withoutVersion = stripTrailingVersionAndApproval(withoutLeadingCode);
  const aliasMatch = findLikelyAliasMatch(withoutVersion);
  const nameSource = aliasMatch?.index != null
    ? withoutVersion.slice(0, aliasMatch.index)
    : withoutVersion.replace(/\s*\([^()]*\)\s*$/g, "");
  const cleaned = normalizeWhitespace(nameSource).replace(/[.,;:]+$/g, "");
  return stripWrappingQuotes(cleaned).replace(/[.,;:]+$/g, "").trim() || code;
}

function extractMethodologyReferenceFromSegment(segment: string, code: string): MethodologyReference {
  const normalized = normalizeWhitespace(normalizeDashCharacters(segment));
  const methodologyName = extractMethodologyNameFromSegment(normalized, code);
  const aliasMatch = normalized.match(/\((REDD[+-]?MF)\)/i);

  return {
    methodologyId: code,
    methodologyName,
    methodologyAlias: aliasMatch ? aliasMatch[1]!.toUpperCase() : null,
    pddDeclaredMethodologyVersion: extractVersionForMethodologyCode(normalized, code),
  };
}

function extractMethodologyReferenceFromRowSegment(segment: string, code: string): MethodologyReference {
  const normalized = isolateMethodologyRowBody(segment);
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowMatch = normalized.match(
    new RegExp(
      `(?:Applied(?:\\s+Methodology)?|Methodology)\\s+${escapedCode}\\s+(?:${escapedCode}\\s+)?(.+?)\\s+([0-9]+(?:[.-][0-9]+){0,2})`,
      "i",
    ),
  );

  if (!rowMatch) {
    return extractMethodologyReferenceFromSegment(normalized, code);
  }

  const nameSource = rowMatch[1] ?? "";
  const aliasMatch = nameSource.match(/\((REDD[+-]?MF)\)/i);
  const cleanedName = aliasMatch?.index != null
    ? nameSource.slice(0, aliasMatch.index).trim()
    : nameSource.replace(/\s*\([^()]*\)\s*$/g, "").trim();
  return {
    methodologyId: code,
    methodologyName: cleanedName || code,
    methodologyAlias: aliasMatch ? aliasMatch[1]!.toUpperCase() : null,
    pddDeclaredMethodologyVersion: normalizeDeclaredMethodologyVersion(rowMatch[2]!) ?? null,
  };
}

function extractMethodologyRowReferencesFromQuote(quote: string): MethodologyReference[] {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  const rowStartPattern = /(?:Applied(?:\s+Methodology)?|Methodology)\s+(VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/gi;
  const matches = [...normalized.matchAll(rowStartPattern)];
  const seen = new Set<string>();
  const references: MethodologyReference[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const code = match[1]!.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);

    const nextMatch = matches.slice(index + 1).find((entry) => {
      const nextCode = entry[1]?.toUpperCase();
      return Boolean(nextCode && nextCode !== code);
    });
    const endIndex = nextMatch?.index ?? normalized.length;
    const segment = normalized.slice(match.index ?? 0, endIndex).trim();
    references.push(extractMethodologyReferenceFromRowSegment(segment, code));
  }

  return references;
}

function extractDistinctMethodologyCodes(quote: string): Array<{ code: string; index: number }> {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  const matches = [...normalized.matchAll(GLOBAL_PRIMARY_METHODOLOGY_CODE_RE)];
  const seen = new Set<string>();
  const codes: Array<{ code: string; index: number }> = [];

  for (const match of matches) {
    const code = match[0]!.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push({ code, index: match.index ?? 0 });
  }

  return codes;
}

export function extractMethodologyReferencesFromQuote(quote: string): MethodologyReference[] {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  const rowReferences = extractMethodologyRowReferencesFromQuote(normalized);
  if (rowReferences.length > 0) {
    return rowReferences;
  }

  const codes = extractDistinctMethodologyCodes(normalized);
  if (codes.length === 0) return [];

  const references: MethodologyReference[] = [];

  for (let index = 0; index < codes.length; index += 1) {
    const current = codes[index]!;
    const nextDistinct = codes.slice(index + 1).find((entry) => entry.code !== current.code);
    const endIndex = nextDistinct?.index ?? normalized.length;
    const segment = normalized.slice(current.index, endIndex).trim();
    references.push(extractMethodologyReferenceFromSegment(segment, current.code));
  }

  return references;
}

export function formatMethodologyReference(reference: MethodologyReference, options?: {
  includeName?: boolean;
  includeVersion?: boolean;
  includeAlias?: boolean;
}): string {
  const includeName = options?.includeName ?? true;
  const includeVersion = options?.includeVersion ?? true;
  const includeAlias = options?.includeAlias ?? true;
  const parts = [reference.methodologyId];

  if (includeName && reference.methodologyName.trim()) {
    parts.push(reference.methodologyName.trim());
  }

  if (includeAlias && reference.methodologyAlias?.trim()) {
    parts[parts.length - 1] = `${parts[parts.length - 1]} (${reference.methodologyAlias.trim()})`;
  }

  if (includeVersion && reference.pddDeclaredMethodologyVersion?.trim()) {
    parts.push(reference.pddDeclaredMethodologyVersion.trim());
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function formatHybridMethodologyAnswer(quote: string): string | null {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  if (!/\bmaterially applicable\b/i.test(normalized) || !/\bnot materially applicable\b/i.test(normalized)) {
    return null;
  }

  const references = extractMethodologyReferencesFromQuote(normalized);
  if (references.length < 2) return null;

  const primary = references[0]!;
  const fallback = references.find((reference) => reference.methodologyId !== primary.methodologyId) ?? null;
  if (!fallback) return null;

  const primaryVersion = primary.pddDeclaredMethodologyVersion ?? "";
  const primaryLabel = primaryVersion ? `${primary.methodologyId} ${primaryVersion}` : primary.methodologyId;
  const fallbackLabel = formatMethodologyReference(
    {
      ...fallback,
    },
    {
      includeAlias: false,
      includeName: true,
      includeVersion: Boolean(fallback.pddDeclaredMethodologyVersion),
    },
  );

  const primaryClause = "where materially applicable";
  const fallbackClause = `where ${primary.methodologyId} is not materially applicable`;

  return `Hybrid methodology: ${primaryLabel} ${primaryClause}, and ${fallbackLabel} ${fallbackClause}.`;
}
