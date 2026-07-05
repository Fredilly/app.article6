import type { RetrievedEvidence } from "@/lib/quickCheckV2/evidence";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

export type QuickCheckMethodologyVersionStatus =
  | "DECLARED"
  | "NOT_EXPLICITLY_DECLARED"
  | "UNKNOWN";

export type QuickCheckMethodologyIdentity = Readonly<{
  methodologyId: string;
  methodologyName: string;
  methodologyAlias: string;
  pddDeclaredMethodologyVersion: string | null;
  versionStatus: QuickCheckMethodologyVersionStatus;
  evidencePage: number;
  evidenceSection: string;
  evidenceQuote: string;
}>;

const PRIMARY_METHODOLOGY_CODE_RE =
  /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDashCharacters(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, "-");
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^[“"'\(\[]+/, "").replace(/[”"'\)\]]+$/, "").trim();
}

function stripParentheticalGroups(value: string): string {
  return value.replace(/\s*\([^)]*\)/g, " ");
}

function stripTrailingVersionAndApproval(value: string): string {
  const normalized = normalizeDashCharacters(value);
  return normalized
    .replace(/\s*(?:,|\()?\s*(?:version|v)\s*\d+(?:[.-]\d+){0,2}.*$/i, "")
    .replace(/\s*approved.*$/i, "")
    .trim();
}

function extractMethodologyCode(quote: string): string | null {
  const match = quote.match(PRIMARY_METHODOLOGY_CODE_RE);
  return match?.[0]?.toUpperCase() ?? null;
}

function extractVersionFromQuote(quote: string): string | null {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  const explicitVersion = normalized.match(
    /\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+){0,2})\b/i,
  );
  if (explicitVersion?.[1]) {
    return normalizeDeclaredMethodologyVersion(explicitVersion[0]);
  }

  const parentheticalVersion = normalized.match(/\((?:[^)]*?)\bversion\s*([0-9]+(?:[.-][0-9]+){0,2})\b[^)]*\)/i);
  if (parentheticalVersion?.[1]) {
    return normalizeDeclaredMethodologyVersion(parentheticalVersion[0]);
  }

  return null;
}

function extractAlias(body: string): string {
  const aliasMatch = normalizeDashCharacters(body).match(
    /\(([^)]+)\)(?:\s+(?:(?:version|ver\.?|v\.?)\s*)?\d+(?:[.-]\d+)*|\s+\d+(?:[.-]\d+)*)?\s*$/i,
  );
  if (!aliasMatch?.[1]) return "";
  const alias = stripWrappingQuotes(normalizeWhitespace(normalizeDashCharacters(aliasMatch[1])));
  return alias || "";
}

function extractMethodologyName(body: string): string {
  const withoutAlias = stripParentheticalGroups(normalizeDashCharacters(body));
  const cleaned = normalizeWhitespace(stripTrailingVersionAndApproval(withoutAlias))
    .replace(/[.,;:]+$/g, "")
    .replace(/[“”]/g, "");
  return stripWrappingQuotes(cleaned).replace(/[.,;:]+$/g, "").trim();
}

function parseTabularMethodologyIdentity(
  quote: string,
): Pick<QuickCheckMethodologyIdentity, "methodologyId" | "methodologyName" | "methodologyAlias" | "pddDeclaredMethodologyVersion"> | null {
  const normalized = normalizeWhitespace(normalizeDashCharacters(quote));
  const rowMatch = normalized.match(
    /\b(?:Applied\s+Methodology|Methodology)\s+(VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+(.+?)\s+(?:v\.?\s*)?(\d+(?:[.-]\d+)*)\b(?=\s+(?:Module|Tool|Applied\s+Methodology|Methodology|$))/i,
  );

  if (!rowMatch) return null;

  const methodologyId = rowMatch[1]!.toUpperCase();
  const version = normalizeDeclaredMethodologyVersion(rowMatch[3]!) ?? null;
  if (!version) return null;

  const titleChunk = normalizeWhitespace(rowMatch[2]!)
    .replace(new RegExp(`^(?:${methodologyId}\\b\\s+)+`, "i"), "")
    .replace(/\s+(?:v\.?\s*)?\d+(?:[.-]\d+)*\s*$/i, "")
    .trim();
  const aliasMatch = titleChunk.match(/\((REDD[+-]?MF)\)/i);
  const methodologyAlias = aliasMatch?.[1]?.toUpperCase() ?? "";
  const methodologyName = normalizeWhitespace(
    stripWrappingQuotes(stripParentheticalGroups(titleChunk)).replace(/[.,;:]+$/g, "").replace(/[“”]/g, ""),
  );

  return {
    methodologyId,
    methodologyName: methodologyName || methodologyId,
    methodologyAlias,
    pddDeclaredMethodologyVersion: version,
  };
}

function versionStatusFromQuote(version: string | null, body: string): QuickCheckMethodologyVersionStatus {
  if (version) return "DECLARED";
  return body.trim() ? "NOT_EXPLICITLY_DECLARED" : "UNKNOWN";
}

export function buildQuickCheckMethodologyIdentity(evidence: RetrievedEvidence | null | undefined): QuickCheckMethodologyIdentity | null {
  if (!evidence) return null;

  const quote = normalizeWhitespace(evidence.quote);
  if (!quote) return null;

  const tabularIdentity = parseTabularMethodologyIdentity(quote);
  if (tabularIdentity) {
    return {
      ...tabularIdentity,
      versionStatus: "DECLARED",
      evidencePage: evidence.page,
      evidenceSection: evidence.sectionHeading?.trim() || (evidence.sectionPath.length > 0 ? evidence.sectionPath.join(" / ") : ""),
      evidenceQuote: evidence.quote,
    };
  }

  const methodologyId = extractMethodologyCode(quote);
  if (!methodologyId) return null;

  const codeIndex = quote.toUpperCase().indexOf(methodologyId);
  const rawBody = codeIndex >= 0 ? quote.slice(codeIndex + methodologyId.length) : quote;
  const body = normalizeWhitespace(normalizeDashCharacters(rawBody).replace(/^[:\s\-–—]+/, ""));
  const pddDeclaredMethodologyVersion = extractVersionFromQuote(quote);
  const methodologyName = extractMethodologyName(body) || methodologyId;
  const methodologyAlias = extractAlias(body);

  return {
    methodologyId,
    methodologyName,
    methodologyAlias,
    pddDeclaredMethodologyVersion,
    versionStatus: versionStatusFromQuote(pddDeclaredMethodologyVersion, body),
    evidencePage: evidence.page,
    evidenceSection: evidence.sectionHeading?.trim() || (evidence.sectionPath.length > 0 ? evidence.sectionPath.join(" / ") : ""),
    evidenceQuote: evidence.quote,
  };
}

export function formatMethodologyDisplayLabel(identity: Pick<
  QuickCheckMethodologyIdentity,
  "methodologyId" | "methodologyName" | "methodologyAlias"
>): string {
  return identity.methodologyAlias?.trim() || identity.methodologyName.trim() || identity.methodologyId.trim();
}
