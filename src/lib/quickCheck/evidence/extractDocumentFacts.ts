import type {
  DocumentFact,
  DocumentFactKind,
  EvidenceDocument,
  EvidenceSpan,
} from "@/lib/quickCheck/evidence/evidenceTypes";
import { normalizeEvidenceText } from "@/lib/quickCheck/evidence/compileEvidenceDocument";

type FactConfidence = DocumentFact["confidence"];

type SpanMatch = {
  span: EvidenceSpan;
  value: string;
  confidence: FactConfidence;
};

const PERIOD_PATTERN =
  /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\s*(?:to|-)\s*\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}\s*Q[1-4]\s*(?:to|-)\s*\d{4}\s*Q[1-4]|\d{4}\s*(?:to|-)\s*\d{4})\b/;
const METHODOLOGY_CODE_PATTERN =
  /\b(?:VM\d{4}|VMR\d{3,4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AR-(?:ACM|AMS|AM)\d{4}|GS-?VER\d+|AMS-?[A-Z]\w+(?:\.\w+)*)\b(?:\s+Version\s+[0-9][A-Za-z0-9.\-]*)?/i;
const PROJECT_TITLE_LABELS = [
  "Project Title",
  "Title of project activity",
  "Title of the project activity",
  "Project name",
];
const METHODOLOGY_LABELS = [
  "Methodology",
  "Title and reference of methodology",
  "Title and reference of methodology applied",
  "Title and reference of the VCS methodology applied",
  "Title and Reference of Methodology",
  "Applied methodology",
  "Approved methodology",
];
const GENERIC_TITLE_RE =
  /^(?:project description(?: document| \/ ?pd)?|project document|document body|table of contents|contents|verra(?:\s+vcs)?(?:\s*\/\s*ccb)?|vcs version\s+\S+|version\s+\S+|page\s+\d+(?:\s+of\s+\d+)?)$/i;
const PROJECT_TITLE_PREFIX_RE = /^(?:project description(?: document| \/ ?pd)?|project document)\s*[:\-]\s*/i;
const METHODOLOGY_HEADING_RE =
  /title and reference of (?:the vcs )?methodology(?: applied)?|applied methodology|approved methodology|application of methodology|methodology applied/i;
const COUNTRY_HINT_RE = /\b(?:republic of|host party|host country|country|project location|location|project proponent address)\b/i;
const LOCATION_SECTION_RE = /\bproject location\b/i;
const COUNTRY_STOP_WORDS = new Set([
  "area",
  "boundary",
  "central",
  "country",
  "county",
  "district",
  "forest",
  "highlands",
  "management",
  "northern",
  "province",
  "project",
  "region",
  "site",
  "southern",
  "state",
  "western",
  "eastern",
]);

function cleanValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*([,:;])\s*/g, "$1 ")
    .replace(/\s*\.\s+/g, ". ")
    .trim()
    .replace(/[.;:,]$/, "")
    .trim();
}

function sentenceFromSpan(span: EvidenceSpan, pattern: RegExp): string | null {
  const match = pattern.exec(span.text);
  if (!match || typeof match.index !== "number") return null;
  const tail = span.text.slice(match.index).trim();
  const sentence = tail.match(/^[^.!?\n]+[.!?]?/)?.[0] ?? tail;
  return cleanValue(sentence);
}

function findLabeledValue(
  spans: EvidenceSpan[],
  labels: string[],
  options?: { allowMultiline?: boolean; preferBlockTypes?: EvidenceSpan["blockType"][]; pattern?: RegExp },
): SpanMatch | null {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`^\\s*(?:${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i");
  const candidates: SpanMatch[] = [];

  for (const span of spans) {
    if (options?.preferBlockTypes && !options.preferBlockTypes.includes(span.blockType)) continue;
    const match = span.text.match(pattern);
    if (!match?.[1]) continue;
    const tail = match[1].trim();
    const rawValue = options?.pattern
      ? options.pattern.exec(tail)?.[0] ?? ""
      : options?.allowMultiline
        ? tail
        : tail.split(/\s{2,}|\n/)[0];
    const value = cleanValue(rawValue);
    if (!value) continue;
    const confidence: FactConfidence =
      span.blockType === "field" || span.blockType === "table" ? "high" : "medium";
    candidates.push({ span, value, confidence });
  }

  return candidates[0] ?? null;
}

function findSpanIndex(spans: EvidenceSpan[], spanId: string): number {
  return spans.findIndex((span) => span.spanId === spanId);
}

function earlyDocumentSpans(spans: EvidenceSpan[]): EvidenceSpan[] {
  const early: EvidenceSpan[] = [];
  for (const span of spans) {
    if (span.blockType === "section_heading" && early.length > 0) break;
    early.push(span);
    if (early.length >= 8) break;
  }
  return early;
}

function isMethodologyLike(value: string): boolean {
  return METHODOLOGY_CODE_PATTERN.test(value) || /\bmethodolog(?:y|ies)\b/i.test(value);
}

function normalizeTitleCandidate(value: string): string {
  return cleanValue(
    value
      .replace(PROJECT_TITLE_PREFIX_RE, "")
      .replace(/\b(?:Verra\s+VCS(?:\s*\/\s*CCB)?|VCS Version\s+\S+|CCB|Gold Standard)\b.*$/i, "")
      .replace(/\b(?:VM\d{4}|VMR\d{3,4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AR-(?:ACM|AMS|AM)\d{4}|GS-?VER\d+|AMS-?[A-Z]\w+(?:\.\w+)*)\b.*$/i, "")
      .trim(),
  );
}

function isUsableProjectTitle(value: string): boolean {
  const normalized = normalizeTitleCandidate(value);
  if (!normalized) return false;
  if (GENERIC_TITLE_RE.test(normalized)) return false;
  if (/^[A-Za-z]{1,6}[_-][A-Za-z0-9_-]+$/.test(normalized)) return false;
  if (isMethodologyLike(normalized)) return false;
  if (/^(?:section\s+)?(?:[A-Z]\.)?\d+(?:\.\d+)*\b/i.test(normalized)) return false;
  if (normalized.split(/\s+/).length > 18) return false;
  return /[A-Za-z]/.test(normalized);
}

function findTitleFact(spans: EvidenceSpan[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, PROJECT_TITLE_LABELS, {
    allowMultiline: true,
    preferBlockTypes: ["field", "table", "paragraph"],
  });
  if (labeled && isUsableProjectTitle(labeled.value)) {
    return { ...labeled, value: normalizeTitleCandidate(labeled.value), confidence: labeled.confidence };
  }

  const title = spans.find((span) => span.blockType === "title" && isUsableProjectTitle(span.text));
  if (title) {
    return { span: title, value: normalizeTitleCandidate(title.text), confidence: "high" };
  }

  for (const span of earlyDocumentSpans(spans)) {
    if (span.blockType === "section_heading") break;
    const candidate = normalizeTitleCandidate(span.text);
    if (!isUsableProjectTitle(candidate)) continue;
    return {
      span,
      value: candidate,
      confidence: span.blockType === "paragraph" ? "medium" : "high",
    };
  }

  return null;
}

function findPeriodFact(spans: EvidenceSpan[], labels: string[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, labels, {
    allowMultiline: true,
    pattern: PERIOD_PATTERN,
  });
  if (labeled) return labeled;

  for (const span of spans) {
    if (!labels.some((label) => normalizeEvidenceText(span.text).includes(label))) continue;
    const match = span.text.match(PERIOD_PATTERN);
    if (match?.[1]) {
      return { span, value: cleanValue(match[1]), confidence: "medium" };
    }
  }
  return null;
}

function findMethodologyFact(
  spans: EvidenceSpan[],
  options: { labels: string[]; headingPattern?: RegExp; confidence?: FactConfidence },
): SpanMatch | null {
  const labeled = findLabeledValue(spans, options.labels, {
    allowMultiline: true,
    pattern: METHODOLOGY_CODE_PATTERN,
  });
  if (labeled) return labeled;

  const headingOnly = spans.find((span) => options.headingPattern?.test(span.text));
  if (headingOnly) {
    const inlineMatch = headingOnly.text.match(METHODOLOGY_CODE_PATTERN);
    if (inlineMatch?.[0]) {
      return {
        span: headingOnly,
        value: cleanValue(headingOnly.text.replace(options.headingPattern ?? /^$/, "").trim() || headingOnly.text),
        confidence: options.confidence ?? (headingOnly.blockType === "paragraph" ? "medium" : "high"),
      };
    }

    const index = findSpanIndex(spans, headingOnly.spanId);
    for (let offset = 1; offset <= 3; offset += 1) {
      const candidate = spans[index + offset];
      if (!candidate || candidate.blockType === "section_heading") break;
      if (candidate.blockType === "toc" || candidate.blockType === "footer") continue;
      const match = candidate.text.match(METHODOLOGY_CODE_PATTERN);
      if (match?.[0]) {
        return {
          span: candidate,
          value: cleanValue(candidate.text),
          confidence: options.confidence ?? (candidate.blockType === "paragraph" ? "medium" : "high"),
        };
      }
    }
  }

  for (const span of spans) {
    if (options.headingPattern && !options.headingPattern.test(span.heading ?? "")) continue;
    if (span.blockType === "section_heading") continue;
    const match = span.text.match(METHODOLOGY_CODE_PATTERN);
    if (match?.[0]) {
      return {
        span,
        value: cleanValue(match[0]),
        confidence: options.confidence ?? (span.blockType === "paragraph" ? "medium" : "high"),
      };
    }
  }
  return null;
}

function extractCountryFromText(value: string): string | null {
  const republicMatch = value.match(/\bRepublic of ([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/);
  if (republicMatch?.[1]) return cleanValue(republicMatch[1]);

  const parts = value
    .split(/[,;]+/)
    .map((part) => cleanValue(part))
    .filter(Boolean);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    if (!/^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}$/.test(part)) continue;
    if (part.split(/\s+/).every((word) => COUNTRY_STOP_WORDS.has(word.toLowerCase()))) continue;
    if (COUNTRY_STOP_WORDS.has(part.toLowerCase())) continue;
    return part;
  }

  return null;
}

function findHostCountryFact(spans: EvidenceSpan[]): SpanMatch | null {
  const direct = findLabeledValue(spans, ["Host country", "Host Country", "Host party", "Host Party", "Country"], {
    preferBlockTypes: ["field", "table", "paragraph"],
    allowMultiline: true,
  });
  if (direct) {
    const country = extractCountryFromText(direct.value) ?? cleanValue(direct.value);
    if (country && !COUNTRY_STOP_WORDS.has(country.toLowerCase())) {
      return { ...direct, value: country, confidence: direct.confidence };
    }
  }

  const location = findLabeledValue(spans, ["Project location", "Project Location", "Location", "Project site", "Project Site"], {
    allowMultiline: true,
  });
  if (location) {
    const country = extractCountryFromText(location.value);
    if (country) return { span: location.span, value: country, confidence: "medium" };
  }

  const address = findLabeledValue(spans, ["Project proponent address", "Project participant address", "Project participants address"], {
    allowMultiline: true,
  });
  if (address) {
    const country = extractCountryFromText(address.value);
    if (country) return { span: address.span, value: country, confidence: "medium" };
  }

  for (const span of earlyDocumentSpans(spans)) {
    if (!COUNTRY_HINT_RE.test(span.text) && !(span.heading && LOCATION_SECTION_RE.test(span.heading))) continue;
    const country = extractCountryFromText(span.text);
    if (!country) continue;
    return {
      span,
      value: country,
      confidence: span.blockType === "field" ? "high" : "medium",
    };
  }

  return null;
}

function findProjectLocationFact(spans: EvidenceSpan[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, ["Project location", "Project Location", "Location", "Project site", "Project Site"], {
    allowMultiline: true,
  });
  if (labeled) return labeled;

  for (const span of earlyDocumentSpans(spans)) {
    if (!(span.heading && LOCATION_SECTION_RE.test(span.heading)) && !/project location/i.test(span.text)) continue;
    const sentence = sentenceFromSpan(span, /project location|located in|location/i);
    if (!sentence) continue;
    return {
      span,
      value: sentence,
      confidence: span.blockType === "field" ? "high" : "medium",
    };
  }

  return null;
}

function findGenericMethodologyFact(spans: EvidenceSpan[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, METHODOLOGY_LABELS, {
    allowMultiline: true,
  });
  if (labeled) return labeled;

  const contextual = findMethodologyFact(spans, {
    labels: METHODOLOGY_LABELS,
    headingPattern: METHODOLOGY_HEADING_RE,
    confidence: "medium",
  });
  if (contextual) return contextual;

  return null;
}

function findLeakageValue(spans: EvidenceSpan[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, ["Leakage", "Leakage value", "Leakage emissions"], {
    allowMultiline: true,
  });
  if (labeled) return labeled;

  for (const span of spans) {
    if (!/\bleakage\b/i.test(span.text)) continue;
    const match = span.text.match(/\bleakage\b[^.\n:]*[:\-]?\s*([^.\n]+)/i);
    if (match?.[1]) {
      return {
        span,
        value: cleanValue(match[1]),
        confidence: span.blockType === "paragraph" ? "low" : "medium",
      };
    }
  }
  return null;
}

function findLeakageStatement(spans: EvidenceSpan[]): SpanMatch | null {
  const labeled = findLabeledValue(spans, ["Leakage statement", "Leakage", "Leakage emissions", "Leakage value"], {
    allowMultiline: true,
  });
  if (labeled && normalizeEvidenceText(labeled.value) !== "leakage") return labeled;

  for (const span of spans) {
    if (span.blockType === "section_heading") continue;
    if (!/\bleakage\b/i.test(span.text)) continue;
    const sentence = span.text.match(/[^.!?\n]*\bleakage\b[^.!?\n]*[.!?]?/i)?.[0];
    const value = cleanValue(sentence ?? "");
    if (!value) continue;
    if (normalizeEvidenceText(value) === "leakage") continue;
    return {
      span,
      value,
      confidence: span.blockType === "paragraph" ? "medium" : "high",
    };
  }

  return null;
}

function findNarrativeFact(spans: EvidenceSpan[], labels: string[], kind: "baseline" | "additionality"): SpanMatch | null {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const sentencePattern = new RegExp(`(?:${labelPattern})`, "i");

  const orderedSpans = [
    ...spans.filter((span) => span.blockType !== "section_heading"),
    ...spans.filter((span) => span.blockType === "section_heading"),
  ];

  for (const span of orderedSpans) {
    if (!sentencePattern.test(span.text)) continue;
    const value = sentenceFromSpan(span, sentencePattern);
    if (!value) continue;
    return {
      span,
      value,
      confidence: span.blockType === "section_heading" ? "low" : kind === "baseline" ? "medium" : "high",
    };
  }

  return null;
}

function toFact(kind: DocumentFactKind, match: SpanMatch | null): DocumentFact | null {
  if (!match) return null;
  return {
    kind,
    value: match.value,
    evidenceSpanIds: [match.span.spanId],
    confidence: match.confidence,
  };
}

export function extractDocumentFacts(document: EvidenceDocument): DocumentFact[] {
  const spans = document.spans.filter((span) => span.blockType !== "toc" && span.blockType !== "footer");
  const facts: Array<DocumentFact | null> = [
    toFact("project_title", findTitleFact(spans)),
    toFact("host_country", findHostCountryFact(spans)),
    toFact("project_location", findProjectLocationFact(spans)),
    toFact("project_participants", findLabeledValue(spans, ["Project participants", "Participants", "Project proponent"], { allowMultiline: true })),
    toFact("baseline_methodology", findMethodologyFact(spans, {
      labels: ["Baseline methodology", ...METHODOLOGY_LABELS],
      headingPattern: METHODOLOGY_HEADING_RE,
    })),
    toFact("methodology", findGenericMethodologyFact(spans)),
    toFact("monitoring_methodology", findMethodologyFact(spans, {
      labels: ["Monitoring methodology", "Monitoring approach", "Monitoring method"],
      headingPattern: /name and reference of approved monitoring methodology applied|monitoring methodology|monitoring applied/i,
    })),
    toFact("crediting_period", findPeriodFact(spans, ["crediting period"])),
    toFact("reporting_period", findPeriodFact(spans, ["reporting period"])),
    toFact("monitoring_period", findPeriodFact(spans, ["monitoring period"])),
    toFact("leakage_value", findLeakageValue(spans)),
    toFact("leakage_statement", findLeakageStatement(spans)),
    toFact("baseline_scenario", findNarrativeFact(spans, ["Baseline scenario", "Baseline scenario is", "Baseline"], "baseline")),
    toFact("additionality_claim", findNarrativeFact(spans, ["Additionality", "Project is additional", "Additional"], "additionality")),
  ];

  return facts.filter((fact): fact is DocumentFact => Boolean(fact));
}
