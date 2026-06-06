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

function findTitleFact(spans: EvidenceSpan[]): SpanMatch | null {
  const title = spans.find((span) => span.blockType === "title" && cleanValue(span.text));
  if (!title) return null;
  return { span: title, value: cleanValue(title.text), confidence: "high" };
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
    toFact("host_country", findLabeledValue(spans, ["Host country", "Host party", "Country"], { preferBlockTypes: ["field", "table", "paragraph"] })),
    toFact("project_location", findLabeledValue(spans, ["Project location", "Location", "Project site"], { allowMultiline: true })),
    toFact("project_participants", findLabeledValue(spans, ["Project participants", "Participants", "Project proponent"], { allowMultiline: true })),
    toFact("baseline_methodology", findMethodologyFact(spans, {
      labels: ["Baseline methodology", "Applied methodology", "Approved methodology", "Methodology"],
    })),
    toFact("methodology", findLabeledValue(spans, ["Methodology", "Applied methodology", "Approved methodology"], { allowMultiline: true })),
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
