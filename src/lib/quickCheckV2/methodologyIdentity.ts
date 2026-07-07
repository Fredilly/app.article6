import type { RetrievedEvidence } from "@/lib/quickCheckV2/evidence";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

export type QuickCheckMethodologyVersionStatus =
  | "DECLARED"
  | "NOT_EXPLICITLY_DECLARED"
  | "UNKNOWN";

export type QuickCheckMethodologyIdentity = Readonly<{
  methodologyId: string;
  methodologyName: string;
  methodologyAlias: string | null;
  pddDeclaredMethodologyVersion: string | null;
  versionStatus: QuickCheckMethodologyVersionStatus;
  evidencePage: number;
  evidenceSection: string;
  evidenceQuote: string;
}>;

const PRIMARY_METHODOLOGY_CODE_RE =
  /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i;
const METHODOLOGY_ROW_BOUNDARY_RE = /\b(?:Module|Tool)\b/i;
const LIKELY_ALIAS_RE = /^[A-Z0-9][A-Z0-9+./-]*$/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDashCharacters(value: string): string {
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
  return normalizeDashCharacters(value).replace(
    /^(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+/i,
    "",
  );
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

  const methodologyRowVersion = normalized.match(
    /\bMethodology\s+(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+(?:(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+)?(.+?)\s+([0-9]+(?:[.-][0-9]+){0,2})\b(?=\s+(?:Module|Tool|$))/i,
  );
  if (methodologyRowVersion?.[2]) {
    return normalizeDeclaredMethodologyVersion(methodologyRowVersion[2]);
  }

  const bareTrailingVersion = normalized.match(
    /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4}\s+)?[^.]*?\([^)]+\)\s+([0-9]+(?:[.-][0-9]+){0,2})\s*$/i,
  );
  if (bareTrailingVersion?.[1]) {
    return normalizeDeclaredMethodologyVersion(bareTrailingVersion[1]);
  }

  return null;
}

function extractAlias(body: string): string | null {
  const aliasMatch = findLikelyAliasMatch(
    stripTrailingVersionAndApproval(stripLeadingMethodologyCode(isolateMethodologyRowBody(body))),
  );
  if (!aliasMatch?.[1]) return null;
  const alias = stripWrappingQuotes(normalizeWhitespace(normalizeDashCharacters(aliasMatch[1])));
  return alias || null;
}

function extractMethodologyName(body: string): string {
  const withoutLeadingCode = stripLeadingMethodologyCode(isolateMethodologyRowBody(body));
  const withoutVersion = stripTrailingVersionAndApproval(withoutLeadingCode);
  const aliasMatch = findLikelyAliasMatch(withoutVersion);
  const nameSource = aliasMatch?.index != null
    ? withoutVersion.slice(0, aliasMatch.index)
    : withoutVersion.replace(/\s*\([^()]*\)\s*$/g, "");
  const cleaned = normalizeWhitespace(nameSource).replace(/[.,;:]+$/g, "");
  return stripWrappingQuotes(cleaned).replace(/[.,;:]+$/g, "").trim();
}

function versionStatusFromQuote(version: string | null, body: string): QuickCheckMethodologyVersionStatus {
  if (version) return "DECLARED";
  return body.trim() ? "NOT_EXPLICITLY_DECLARED" : "UNKNOWN";
}

export function buildQuickCheckMethodologyIdentity(evidence: RetrievedEvidence | null | undefined): QuickCheckMethodologyIdentity | null {
  if (!evidence) return null;

  const quote = normalizeWhitespace(evidence.quote);
  if (!quote) return null;

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
