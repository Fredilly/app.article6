import type { DocumentFamily } from "@/lib/documentParsing";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import type {
  ProjectFactConfidence,
  ProjectFactContract,
  ProjectFactContractDocumentType,
  ProjectFactField,
  ProjectFactValue,
} from "@/lib/quickCheck/projectFacts/types";

type Candidate = {
  value: string;
  normalizedValue: string;
  confidence: ProjectFactConfidence;
  span: EvidenceSpan;
  extractionRule: string;
  warnings: string[];
};

type FieldRule = {
  field: keyof Omit<ProjectFactContract, "documentFamily" | "documentType" | "warnings">;
  labels: string[];
  preferBlockTypes?: EvidenceSpan["blockType"][];
  multiline?: boolean;
  familySpecificLabels?: Partial<Record<DocumentFamily, string[]>>;
};

const COUNTRY_RE = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/;
const METHODOLOGY_CODE_RE = /\b(?:V?M|ACM|AM|AMS|AR-AM|AR-ACM|VMR|CDM-SSC|GS)\d{3,5}[A-Z-]*\b/i;
const REGION_DISPLAY_NAMES = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" as Intl.DisplayNamesOptions["type"] })
  : null;
const KNOWN_COUNTRY_NAMES = new Set<string>(
  REGION_DISPLAY_NAMES
    ? Array.from({ length: 26 }, (_, firstIndex) => String.fromCharCode(65 + firstIndex))
      .flatMap((first) => Array.from({ length: 26 }, (_, secondIndex) => `${first}${String.fromCharCode(65 + secondIndex)}`))
      .map((code) => REGION_DISPLAY_NAMES.of(code)?.trim())
      .filter((name): name is string => Boolean(name && name !== "Unknown Region" && name !== "world"))
      .map((name) => name.toLowerCase())
    : [],
);
const FIELD_RULES: FieldRule[] = [
  {
    field: "projectId",
    labels: [
      "Project ID",
      "Project identifier",
      "Project code",
      "Registry project ID",
      "Registry ID",
      "VCS ID",
      "Verra project ID",
      "CDM project ID",
      "GS project ID",
    ],
    preferBlockTypes: ["field", "table", "paragraph"],
  },
  {
    field: "hostCountry",
    labels: ["Host country", "Host country(ies)", "Host Party", "Host Party(ies)"],
    preferBlockTypes: ["field", "table", "paragraph"],
    familySpecificLabels: {
      VCS_PD: ["Country/Area", "Country", "Host Party(ies)", "Host Country", "Geographic location"],
      VERRA_PD: ["Country/Area", "Country", "Host Party(ies)", "Host Country", "Geographic location"],
      REDD_AFOLU: ["Country/Area", "Country", "Host Party", "Geographic location"],
    },
  },
  {
    field: "projectLocation",
    labels: ["Project location", "Project site", "Location", "Geographic location", "Geographic reference"],
    preferBlockTypes: ["field", "table", "paragraph", "title", "formula"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Project location", "Geographic reference of the project activity", "Geographic location"],
      VERRA_PD: ["Project location", "Geographic reference of the project activity", "Geographic location"],
      REDD_AFOLU: ["Project location", "Geographic reference", "Geographic location"],
    },
  },
  {
    field: "projectProponent",
    labels: ["Project proponent", "Project proponent(s)", "Project participants", "Participants", "Project developer"],
    preferBlockTypes: ["field", "table", "paragraph", "title", "formula"],
    multiline: true,
  },
  {
    field: "methodologyPrimary",
    labels: ["Methodology", "Applied methodology", "Approved methodology"],
    preferBlockTypes: ["field", "table", "paragraph", "title", "formula"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Title and reference of methodology applied", "Methodology applied"],
      VERRA_PD: ["Title and reference of methodology applied", "Methodology applied"],
      CDM_PDD: ["Title and reference of the approved baseline and monitoring methodology", "Applied baseline methodology", "Approved baseline and monitoring methodology"],
    },
  },
  {
    field: "baselineMethodology",
    labels: ["Baseline methodology", "Applied baseline methodology"],
    preferBlockTypes: ["field", "table", "paragraph", "title", "formula"],
    multiline: true,
  },
  {
    field: "monitoringMethodology",
    labels: ["Monitoring methodology", "Monitoring approach"],
    preferBlockTypes: ["field", "table", "paragraph", "title", "formula"],
    multiline: true,
  },
  {
    field: "creditingPeriod",
    labels: ["Crediting period", "Project crediting period", "Crediting period of the project activity", "Project Lifetime", "GHG Accounting Period", "Accounting Period"],
    preferBlockTypes: ["field", "paragraph", "title"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Project crediting period", "Crediting period", "Project lifetime"],
      VERRA_PD: ["Project crediting period", "Crediting period", "Project lifetime"],
    },
  },
  {
    field: "reportingPeriod",
    labels: ["Reporting period", "Project crediting period"],
    preferBlockTypes: ["field", "paragraph"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Project crediting period"],
      VERRA_PD: ["Project crediting period"],
    },
  },
  {
    field: "monitoringPeriod",
    labels: ["Monitoring period", "Frequency of monitoring"],
    preferBlockTypes: ["field", "paragraph"],
    multiline: true,
  },
  {
    field: "projectStartDate",
    labels: ["Project start date", "Starting date of the project activity", "Start date"],
    preferBlockTypes: ["field", "paragraph"],
  },
  {
    field: "projectType",
    labels: ["Project type", "Type of project activity"],
    preferBlockTypes: ["field", "paragraph"],
    multiline: true,
  },
];

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s./()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function materializeWarning(message: string): string {
  return message.trim();
}

function createEmptyField<T extends string | string[] | null>(
  extractionRule: string,
  family: DocumentFamily,
  warnings: string[] = [],
): ProjectFactField<T> {
  return {
    value: null as T,
    confidence: "low",
    evidenceSpanIds: [],
    pageNumbers: [],
    sectionPath: [],
    heading: undefined,
    extractionRule,
    sourceParser: undefined,
    family,
    warnings,
  };
}

function rankConfidence(span: EvidenceSpan, options?: { preferStructured?: boolean }): ProjectFactConfidence {
  if (span.reliability === "excluded") return "low";
  if (options?.preferStructured && (span.blockType === "field" || span.blockType === "table")) return "high";
  if (span.confidence >= 0.92) return "high";
  if (span.confidence >= 0.75) return "medium";
  return "low";
}

function chooseDocumentType(family: DocumentFamily): ProjectFactContractDocumentType {
  switch (family) {
    case "CDM_PDD":
    case "GOLD_STANDARD_PDD":
      return "PROJECT_DESIGN_DOCUMENT";
    case "VCS_PD":
    case "VERRA_PD":
      return "PROJECT_DESCRIPTION";
    default:
      return "DOCUMENT";
  }
}

function findLabeledCandidates(
  document: EvidenceDocument,
  rule: FieldRule,
): Candidate[] {
  const labels = dedupe([
    ...rule.labels,
    ...(rule.familySpecificLabels?.[document.documentFamily ?? "UNKNOWN"] ?? []),
  ]);
  // Normalize parenthetical suffixes: "Project Proponent(s)" → "Project Proponent"
  const normalizedLabels = labels.map((l) => l.replace(/\s*\(s\)\s*$|\s*\(ies\)\s*$|\s*\(S\)\s*$/, "").trim());
  const allLabels = dedupe([...labels, ...normalizedLabels]);
  const labelGroup = allLabels.map(escapeRegExp).join("|");

  // Strict: label at start of line with colon or hyphen
  const colonPattern = new RegExp(
    `^\\s*(?:${labelGroup})\\s*[:\\-]\\s*(.+)$`,
    "i",
  );
  // Space-separated: label at start of line followed by whitespace (no colon)
  // Only applied when colon pattern fails, to avoid false matches on
  // lines like "Project Title Community Reforestation"
  const spacePattern = new RegExp(
    `^\\s*(?:${labelGroup})\\s+(.+)$`,
    "i",
  );
  // Relaxed: label anywhere in the span (catches labels after section numbers)
  const relaxedColonPattern = document.documentFamily
    ? new RegExp(
        `\\b(?:${labelGroup})\\s*[:\\-]\\s*(.+)$`,
        "im",
      )
    : null;

  const results: Candidate[] = [];
  const seenValues = new Set<string>();

  for (const span of document.spans.filter((s) => s.reliability !== "excluded")) {
    if (rule.preferBlockTypes && !rule.preferBlockTypes.includes(span.blockType)) continue;

    // Try colon patterns first (strict, then relaxed)
    for (const pattern of [colonPattern, relaxedColonPattern].filter(Boolean) as RegExp[]) {
      const match = span.text.match(pattern);
      if (!match?.[1]) continue;
      const rawValue = rule.multiline ? match[1] : match[1].split(/\s{2,}|\n/)[0];
      const value = rawValue.trim().replace(/[.;:,]$/, "").trim();
      if (!value) continue;
      const dedupeKey = normalizeValue(value);
      if (seenValues.has(dedupeKey)) continue;
      seenValues.add(dedupeKey);
      results.push({
        value,
        normalizedValue: dedupeKey,
        confidence: rankConfidence(span, { preferStructured: true }),
        span,
        extractionRule: `label:${rule.field}`,
        warnings: [],
      });
      break;
    }

    // Space-separated fallback: only for field/table blocks where the
    // label is at the start and followed by a value on the same line.
    const spaceMatch = span.text.match(spacePattern);
    if (spaceMatch?.[1]) {
      const rawValue = rule.multiline ? spaceMatch[1] : spaceMatch[1].split(/\s{2,}|\n/)[0];
      // Trim trailing punctuation and drop annotations after ";" or "("
      let value = rawValue.trim().replace(/[.;:,]$/, "").trim();
      if (value) {
        const semicolonIndex = value.indexOf(";");
        const parenIndex = value.indexOf("(");
        const cutIndex = Math.min(
          semicolonIndex > 0 ? semicolonIndex : Infinity,
          parenIndex > 0 ? parenIndex : Infinity,
        );
        if (cutIndex !== Infinity) {
          value = value.slice(0, cutIndex).trim();
        }
      }
      // Cover-table entries for multiline fields can be longer (date ranges
      // etc).  Monoline fields keep the stricter 8-word guard.
      const maxWords = rule.multiline ? 20 : 8;
      if (value && value.split(/\s+/).length <= maxWords) {
        const dedupeKey = normalizeValue(value);
        if (!seenValues.has(dedupeKey)) {
          seenValues.add(dedupeKey);
          results.push({
            value,
            normalizedValue: dedupeKey,
            confidence: "medium",
            span,
            extractionRule: `label:${rule.field}`,
            warnings: [],
          });
        }
      }
    }
  }

  if (results.length === 0 && rule.multiline) {
    const exactLabels = new Set(allLabels.map((label) => label.toLowerCase()));
    for (let index = 0; index < document.spans.length; index += 1) {
      const span = document.spans[index];
      if (!span || span.reliability === "excluded") continue;
      if (rule.preferBlockTypes && !rule.preferBlockTypes.includes(span.blockType)) continue;
      const labelText = span.text.trim().replace(/[:.-]\s*$/, "").trim().toLowerCase();
      if (!exactLabels.has(labelText)) continue;

      const continuation = document.spans
        .slice(index + 1, index + 4)
        .find((candidate) => {
          if (candidate.reliability === "excluded") return false;
          if (candidate.page !== span.page) return false;
          if (!["paragraph", "field", "formula", "title"].includes(candidate.blockType)) return false;
          const candidateText = candidate.text.trim();
          if (!candidateText) return false;
          if (exactLabels.has(candidateText.toLowerCase())) return false;
          if (/^(?:table of contents|page \d+|version \d)/i.test(candidateText)) return false;
          return true;
        });

      if (!continuation) continue;
      const value = continuation.text.trim().replace(/[.;:,]$/, "").trim();
      if (!value) continue;
      const dedupeKey = normalizeValue(value);
      if (seenValues.has(dedupeKey)) continue;
      seenValues.add(dedupeKey);
      results.push({
        value,
        normalizedValue: dedupeKey,
        confidence: rankConfidence(continuation, { preferStructured: continuation.blockType === "field" || continuation.blockType === "table" }),
        span: continuation,
        extractionRule: `label:${rule.field}:adjacent-span`,
        warnings: [],
      });
    }
  }

  // Heading-label fallback: when no colon/space-pattern candidates were found,
  // look for paragraph/field spans whose heading matches a field label.
  // This handles documents where the label is in the section heading and the
  // value is the body text (common in validation reports).
  //
  // Guard: only accept body text that looks like a real value — at least one
  // comma or at least two interior capitalised words (proper nouns / locations).
  // This prevents generic preamble sentences from being mistaken for a value.
  if (results.length === 0) {
    const headingMatch = document.spans
      .filter((s) => s.reliability !== "excluded")
      .filter((s) => (rule.preferBlockTypes ?? ["field", "paragraph"]).includes(s.blockType))
      .filter((s) => Boolean(s.heading) && allLabels.some((label) => s.heading!.toLowerCase() === label.toLowerCase()))
      .sort((a, b) => (a.page ?? Number.MAX_SAFE_INTEGER) - (b.page ?? Number.MAX_SAFE_INTEGER))[0];
    if (headingMatch) {
      const rawValue = headingMatch.text.trim().replace(/[.;:,]$/, "").trim();
      const commaCount = (rawValue.match(/,/g) ?? []).length;
      const words = rawValue.split(/\s+/).filter(Boolean);
      const interiorProperNouns = words.slice(1).filter((w) => /^[A-Z][a-z]/.test(w)).length;
      if (rawValue && (commaCount >= 1 || interiorProperNouns >= 2)) {
        results.push({
          value: rawValue,
          normalizedValue: normalizeValue(rawValue),
          confidence: "medium",
          span: headingMatch,
          extractionRule: `label:${rule.field}`,
          warnings: [],
        });
      }
    }
  }

  return results;
}

function findMethodologyCodeFallbackCandidates(document: EvidenceDocument): Candidate[] {
  if (!document.documentFamily || document.documentFamily === "UNKNOWN") {
    return [];
  }
  return document.spans
    .filter((span) => span.reliability !== "excluded")
    .filter((span) => span.sectionPath.length === 0)
    .flatMap((span) => {
      const match = span.text.match(METHODOLOGY_CODE_RE);
      if (!match?.[0]) return [];
      return [{
        value: span.text.trim(),
        normalizedValue: normalizeValue(span.text),
        confidence: "medium" as const,
        span,
        extractionRule: "methodology:code-fallback",
        warnings: [
          materializeWarning("Methodology inferred from a top-of-document code reference because no explicit methodology label was found."),
        ],
      }];
    });
}

function factFromCandidates<T extends string | string[] | null>(
  family: DocumentFamily,
  extractionRule: string,
  candidates: Candidate[],
  options?: {
    allowMedium?: boolean;
    transformValue?: (candidate: Candidate) => T;
    combineValues?: (candidates: Candidate[]) => T;
  },
): ProjectFactField<T> {
  if (candidates.length === 0) {
    return createEmptyField<T>(extractionRule, family, [materializeWarning("No deterministic evidence found.")]);
  }

  const normalizedValues = dedupe(candidates.map((candidate) => candidate.normalizedValue));
  if (normalizedValues.length > 1) {
    return {
      value: null as T,
      confidence: "low",
      evidenceSpanIds: dedupe(candidates.map((candidate) => candidate.span.spanId)),
      pageNumbers: dedupe(candidates.map((candidate) => candidate.span.page).filter((page): page is number => page != null)).sort((a, b) => a - b),
      sectionPath: dedupe(candidates.flatMap((candidate) => candidate.span.sectionPath)),
      heading: candidates[0]?.span.heading,
      extractionRule,
      sourceParser: candidates[0]?.span.parserSource,
      family,
      warnings: [materializeWarning(`Conflicting values detected: ${dedupe(candidates.map((candidate) => candidate.value)).join(" | ")}`)],
    };
  }

  const best = [...candidates].sort((left, right) => {
    const order: Record<ProjectFactConfidence, number> = { high: 3, medium: 2, low: 1 };
    return order[right.confidence] - order[left.confidence] || right.span.confidence - left.span.confidence;
  })[0];

  if (!best || (best.confidence === "low" || (best.confidence === "medium" && options?.allowMedium === false))) {
    return {
      value: null as T,
      confidence: best?.confidence ?? "low",
      evidenceSpanIds: best ? [best.span.spanId] : [],
      pageNumbers: best?.span.page != null ? [best.span.page] : [],
      sectionPath: best?.span.sectionPath ?? [],
      heading: best?.span.heading,
      extractionRule,
      sourceParser: best?.span.parserSource,
      family,
      warnings: [materializeWarning("Evidence was too weak to promote into a canonical fact.")],
    };
  }

  const value = options?.combineValues
    ? options.combineValues(candidates)
    : options?.transformValue
      ? options.transformValue(best)
      : best.value as T;

  return {
    value,
    confidence: best.confidence,
    evidenceSpanIds: dedupe(candidates.map((candidate) => candidate.span.spanId)),
    pageNumbers: dedupe(candidates.map((candidate) => candidate.span.page).filter((page): page is number => page != null)).sort((a, b) => a - b),
    sectionPath: dedupe(candidates.flatMap((candidate) => candidate.span.sectionPath)),
    heading: best.span.heading,
    extractionRule: best.extractionRule,
    sourceParser: best.span.parserSource,
    family,
    warnings: dedupe(candidates.flatMap((candidate) => candidate.warnings)),
  };
}

function looksLikeMethodology(value: string): boolean {
  return METHODOLOGY_CODE_RE.test(value)
    || /\bmethodology\b/i.test(value)
    || /\bapproved baseline and monitoring methodology\b/i.test(value);
}

function looksLikeGenericSectionHeading(value: string): boolean {
  const normalized = normalizeValue(value);
  return [
    "project background",
    "project boundary",
    "baseline scenario",
    "additionality",
    "leakage",
    "monitoring",
    "monitoring plan",
    "stakeholder comments",
  ].includes(normalized);
}

function findProjectTitle(document: EvidenceDocument): ProjectFactField<string | null> {
  const family = document.documentFamily ?? "UNKNOWN";

  // Prefer labeled title fields (e.g. A.1 "Title of the project activity:") over
  // TOC/page-header title spans.  CDM PDDs often have noisy title blocks from the
  // cover/TOC that conflict with the real project title.
  // Use a dedicated colon-based match that extracts only the value after "Title of
  // the project activity:" and avoids the conflict-prone short "Title" label.
  for (const span of document.spans.filter((s) => s.reliability !== "excluded")) {
    if (!["field", "paragraph"].includes(span.blockType)) continue;
    const titleMatch = span.text.match(
      /(?:^|\n)\s*(?:The\s+)?title\s+of\s+the\s+project\s+activity\s*:\s*([^\n]+)/i,
    );
    if (titleMatch?.[1]) {
      // Trim trailing metadata: version number, date, document form markers
      const value = titleMatch[1].trim()
        .replace(/\s*The\s+current\s+version\s+number\s+of\s+the\s+document\s*:.*$/i, "")
        .replace(/\s*The\s+date\s+of\s+the\s+document\s+was\s+completed\s*:.*$/i, "")
        .replace(/\s+--\s*\d+\s+of\s+\d+\s*--\s*$/, "")
        .replace(/\s+PROJECT DESIGN DOCUMENT FORM.*$/i, "")
        .replace(/[.;:,]\s*$/, "")
        .trim();
      if (value.length > 5 && !looksLikeMethodology(value)) {
        return {
          value,
          confidence: rankConfidence(span, { preferStructured: true }),
          evidenceSpanIds: [span.spanId],
          pageNumbers: span.page != null ? [span.page] : [],
          sectionPath: span.sectionPath,
          heading: span.heading,
          extractionRule: "title:labeled-field",
          sourceParser: span.parserSource,
          family,
          warnings: [],
        };
      }
    }
  }

  const titleSpans = document.spans.filter((span) => span.blockType === "title" && span.reliability !== "excluded");
  const candidates: Candidate[] = titleSpans
    .filter((span) => !looksLikeMethodology(span.text))
    .filter((span) => !/^section\s+\d/i.test(span.text.trim()))
    .map((span) => ({
      value: span.text.trim(),
      normalizedValue: normalizeValue(span.text),
      confidence: rankConfidence(span),
      span,
      extractionRule: "title:top-span",
      warnings: [],
    }));

  if (candidates.length === 0) {
    const labeledDocumentCandidates = document.spans
      .filter((span) => span.reliability !== "excluded")
      .filter((span) => span.sectionPath.length === 0)
      .filter((span) => span.blockType === "field" || span.blockType === "paragraph")
      .filter((span) => /^(?:project description document|project design document)\s*:\s*\S/i.test(span.text.trim()))
      .map((span) => ({
        value: span.text.trim(),
        normalizedValue: normalizeValue(span.text),
        confidence: rankConfidence(span, { preferStructured: span.blockType === "field" }),
        span,
        extractionRule: "title:labeled-document",
        warnings: [],
      }));
    if (labeledDocumentCandidates.length > 0) {
      return factFromCandidates<string | null>(family, "title", labeledDocumentCandidates);
    }
  }

  if (candidates.length === 0) {
    const headingCandidates = document.spans
      .filter((span) => span.blockType === "section_heading" && span.reliability === "primary")
      .filter((span) => !looksLikeMethodology(span.text))
      .filter((span) => !looksLikeGenericSectionHeading(span.heading ?? span.text))
      .slice(0, 1)
      .map((span) => ({
        value: span.heading ?? span.text.trim(),
        normalizedValue: normalizeValue(span.heading ?? span.text),
        confidence: "medium" as const,
        span,
        extractionRule: "title:first-heading-fallback",
        warnings: [materializeWarning("Title inferred from first heading because no dedicated title span was available.")],
      }));
    return factFromCandidates<string | null>(family, "title", headingCandidates);
  }

  return factFromCandidates<string | null>(family, "title", candidates);
}

function deriveCountryFromLocation(field: ProjectFactField<string | null>, family: DocumentFamily): ProjectFactField<string | null> {
  if (!field.value) {
    return createEmptyField<string | null>("project-country:location-fallback", family, [materializeWarning("Project country was not deterministically derivable.")]);
  }
  const segments = field.value
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const knownCountrySegment = segments.find((segment) => KNOWN_COUNTRY_NAMES.has(segment.toLowerCase()));
  if (knownCountrySegment) {
    return {
      ...field,
      value: knownCountrySegment,
      extractionRule: "project-country:location-country-segment",
    };
  }

  const countryLikeSegment = segments.find((segment) => {
    if (/\b(?:province|state|district|county|municipality|regency|region|island|islands)\b/i.test(segment)) {
      return false;
    }
    return Boolean(segment.match(COUNTRY_RE)?.[1]);
  });
  if (countryLikeSegment) {
    return {
      ...field,
      value: countryLikeSegment.match(COUNTRY_RE)?.[1] ?? countryLikeSegment,
      extractionRule: "project-country:location-countrylike-segment",
    };
  }

  const trailing = segments[segments.length - 1] ?? field.value;
  const match = trailing.match(COUNTRY_RE);
  if (!match?.[1]) {
    return createEmptyField<string | null>("project-country:location-fallback", family, [materializeWarning("Project location did not contain a clear country.")]);
  }
  return {
    ...field,
    value: match[1],
    extractionRule: "project-country:location-fallback",
  };
}

function standardFact(document: EvidenceDocument): ProjectFactField<string | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const standardByFamily: Record<DocumentFamily, string | null> = {
    CDM_PDD: "CDM",
    VCS_PD: "VCS",
    VERRA_PD: "Verra VCS",
    GOLD_STANDARD_PDD: "Gold Standard",
    REDD_AFOLU: null,
    ENERGY: null,
    UNKNOWN: null,
  };
  const value = standardByFamily[family];
  if (!value) return createEmptyField<string | null>("standard:family", family, [materializeWarning("Document family did not map to a deterministic project standard.")]);
  return {
    value,
    confidence: "high",
    evidenceSpanIds: [],
    pageNumbers: [],
    sectionPath: [],
    heading: undefined,
    extractionRule: "standard:family",
    sourceParser: document.parserSource,
    family,
    warnings: [],
  };
}

function methodologyModulesFact(document: EvidenceDocument, methodologyPrimary: ProjectFactField<string | null>): ProjectFactField<string[] | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const candidates = dedupe(
    document.spans
      .filter((span) => span.reliability !== "excluded")
      .flatMap((span) => span.text.match(/\b(?:module|modules?)\s+([A-Z0-9, .-]+)/gi) ?? []),
  );
  if (candidates.length === 0 && methodologyPrimary.value && METHODOLOGY_CODE_RE.test(methodologyPrimary.value)) {
    return {
      ...createEmptyField<string[] | null>("methodology-modules:none", family),
      warnings: [materializeWarning("No methodology modules were separately declared.")],
    };
  }
  if (candidates.length === 0) {
    return createEmptyField<string[] | null>("methodology-modules:none", family, [materializeWarning("No methodology modules were found.")]);
  }
  return {
    value: candidates,
    confidence: "medium",
    evidenceSpanIds: dedupe(document.spans.filter((span) => candidates.some((candidate) => span.text.includes(candidate))).map((span) => span.spanId)),
    pageNumbers: dedupe(document.spans.filter((span) => candidates.some((candidate) => span.text.includes(candidate))).map((span) => span.page).filter((page): page is number => page != null)).sort((a, b) => a - b),
    sectionPath: dedupe(document.spans.filter((span) => candidates.some((candidate) => span.text.includes(candidate))).flatMap((span) => span.sectionPath)),
    heading: document.spans.find((span) => candidates.some((candidate) => span.text.includes(candidate)))?.heading,
    extractionRule: "methodology-modules:regex",
    sourceParser: document.parserSource,
    family,
    warnings: [],
  };
}

function sectionsFact(
  document: EvidenceDocument,
  fieldName: string,
  terms: string[],
): ProjectFactField<string[] | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const normalizedTerms = terms.map((t) => normalizeValue(t));

  // Section headings — use full span text (not truncated heading) so that
  // terms near the end of long CDM headings are still matched.
  const headingMatches = document.spans.filter((span) => (
    span.reliability !== "excluded"
    && span.blockType === "section_heading"
    && normalizedTerms.some((term) => (
      normalizeValue(span.text).includes(term)
      || span.headingPath.some((heading) => normalizeValue(heading).includes(term))
      || normalizeValue(span.heading ?? "").includes(term)
    ))
  ));

  // Body paragraph/field matches — catches inline anchors like "Leakage" that
  // appear as standalone paragraphs within a parent section.
  const bodyMatches = document.spans.filter((span) => (
    span.reliability !== "excluded"
    && (span.blockType === "paragraph" || span.blockType === "field")
    && normalizedTerms.some((term) => (
      span.headingPath.some((heading) => normalizeValue(heading).includes(term))
      // Inline match: a paragraph whose text starts with the term (e.g. "Leakage covers...")
      || (/^[A-Z]/.test(span.text.trim()) && normalizeValue(span.text.trim()).startsWith(term))
    ))
  ));

  // Raw text fallback — when the document parser merges inline section anchors
  // (like a standalone "Leakage" heading within a parent section) into the
  // parent's paragraph span, look for the term as a line prefix in the raw text.
  const rawTextLines = document.rawText?.split("\n") ?? [];
  const rawLineMatches = headingMatches.length === 0 && bodyMatches.length === 0
    ? rawTextLines.filter((line) => {
        const trimmed = line.trim();
        if (!/^[A-Z][a-z]/.test(trimmed)) return false;
        return normalizedTerms.some((term) => normalizeValue(trimmed).startsWith(term));
      })
    : [];

  const matches = headingMatches.length > 0 ? headingMatches
    : bodyMatches.length > 0 ? bodyMatches
    : [];

  if (matches.length === 0 && rawLineMatches.length === 0) {
    return createEmptyField<string[] | null>(`sections:${fieldName}`, family, [materializeWarning(`No ${fieldName} sections were found.`)]);
  }

  if (rawLineMatches.length > 0 && matches.length === 0) {
    return {
      value: dedupe(rawLineMatches.map((line) => line.trim().slice(0, 80))),
      confidence: "low" as const,
      evidenceSpanIds: [],
      pageNumbers: [],
      sectionPath: [],
      heading: rawLineMatches[0].trim().slice(0, 80),
      extractionRule: `sections:${fieldName}:raw-text`,
      sourceParser: document.parserSource,
      family,
      warnings: [materializeWarning(`${fieldName} section inferred from raw text line prefix.`)],
    };
  }

  const values = dedupe(matches.map((span) => span.heading ?? span.sectionId ?? span.text).filter(Boolean));
  return {
    value: values,
    confidence: "medium",
    evidenceSpanIds: dedupe(matches.map((span) => span.spanId)),
    pageNumbers: dedupe(matches.map((span) => span.page).filter((page): page is number => page != null)).sort((a, b) => a - b),
    sectionPath: dedupe(matches.flatMap((span) => span.sectionPath)),
    heading: matches[0]?.heading,
    extractionRule: `sections:${fieldName}`,
    sourceParser: matches[0]?.parserSource,
    family,
    warnings: [],
  };
}

function findField(document: EvidenceDocument, field: FieldRule): ProjectFactField<string | null> {
  return factFromCandidates(document.documentFamily ?? "UNKNOWN", field.field, findLabeledCandidates(document, field), {
    allowMedium: true,
  });
}

/**
 * CDM-specific: find methodology by locating the B.1 heading and scanning the
 * following paragraphs for a methodology code (ACM0010, AMS-III.H, etc.).
 */
function findMethodologyFromB1Heading(
  document: EvidenceDocument,
  rule: FieldRule,
): ProjectFactField<string | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const spans = document.spans.filter((s) => s.reliability !== "excluded");

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (span.blockType !== "section_heading") continue;
    if (span.sectionId !== "section:B.1") continue;

    // Scan the next few paragraphs for a methodology code
    for (let j = i + 1; j < spans.length && j <= i + 5; j++) {
      const next = spans[j];
      if (next.blockType === "section_heading") break;
      const codeMatch = next.text.match(METHODOLOGY_CODE_RE);
      if (codeMatch) {
        // Extract the methodology code and surrounding context
        const codeIndex = codeMatch.index ?? 0;
        const context = next.text.slice(Math.max(0, codeIndex - 20), codeIndex + 100).trim();
        const candidate: Candidate = {
          value: context,
          normalizedValue: normalizeValue(context),
          confidence: rankConfidence(span, { preferStructured: true }),
          span: next,
          extractionRule: "label:methodologyPrimary:b1-code",
          warnings: [],
        };
        return factFromCandidates<string | null>(family, rule.field, [candidate], { allowMedium: true });
      }
    }
    break;
  }

  return createEmptyField<string | null>("methodology:b1-code", family, [materializeWarning("No methodology code found near B.1 heading.")]);
}

/**
 * When a CDM-style heading contains the label (e.g. "A.4.1.1 Host Party(ies):")
 * but the value follows on the next line/span, standard findField fails because
 * the colon-matched value is empty.  This fallback scans for headings matching
 * the rule's labels and extracts the next non-empty paragraph/field span.
 */
function findFieldFromHeadingValue(document: EvidenceDocument, rule: FieldRule): ProjectFactField<string | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const labels = dedupe([
    ...rule.labels,
    ...(rule.familySpecificLabels?.[family] ?? []),
  ]);
  const normalizedLabels = labels.map((l) => l.replace(/\s*\(s\)\s*$|\s*\(ies\)\s*$|\s*\(S\)\s*$/, "").trim());
  const allLabels = dedupe([...labels, ...normalizedLabels]);
  const labelGroup = allLabels.map(escapeRegExp).join("|");
  const headingPattern = new RegExp(`\\b(?:${labelGroup})\\s*:?\\s*$`, "i");

  const spans = document.spans.filter((s) => s.reliability !== "excluded");
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (span.blockType !== "section_heading" && span.blockType !== "field") continue;

    const cleanText = span.text.trim().replace(/^\s*[A-Z][.]?\d+[.]?\d*[.]?\d*\s*/, "").trim();
    if (!headingPattern.test(cleanText)) continue;

    // Value is in the next non-empty span
    for (let j = i + 1; j < spans.length && j <= i + 3; j++) {
      const next = spans[j];
      const rawValue = next.text.trim();
      if (!rawValue || rawValue.length < 2) continue;
      if (next.blockType === "section_heading") break;

      // Trim trailing noise: map captions, page markers, figure references
      const value = rawValue
        .replace(/\s*Figure\s+[A-Z]?\d*[.:].*$/i, "")
        .replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*$/i, "")
        .replace(/\s+PROJECT DESIGN DOCUMENT FORM.*$/i, "")
        .trim();

      const candidate: Candidate = {
        value,
        normalizedValue: normalizeValue(value),
        confidence: rankConfidence(span, { preferStructured: true }),
        span: next,
        extractionRule: `label:${rule.field}:heading-next`,
        warnings: [],
      };
      return factFromCandidates<string | null>(family, rule.field, [candidate], { allowMedium: true });
    }
  }

  return createEmptyField<string | null>(`label:${rule.field}:heading-next`, family, [materializeWarning(`No ${rule.field} heading-value pair was found.`)]);
}

function inferProjectType(document: EvidenceDocument): ProjectFactField<string | null> {
  const family = document.documentFamily ?? "UNKNOWN";
  const explicit = findField(document, FIELD_RULES.find((rule) => rule.field === "projectType") as FieldRule);
  if (explicit.value) return explicit;

  const inferredValue =
    family === "REDD_AFOLU" ? "REDD/AFOLU"
      : family === "ENERGY" ? "Energy"
        : null;
  if (!inferredValue) {
    return createEmptyField<string | null>("project-type:family", family, [materializeWarning("Project type was not explicitly stated.")]);
  }
  return {
    value: inferredValue,
    confidence: "medium",
    evidenceSpanIds: [],
    pageNumbers: [],
    sectionPath: [],
    heading: undefined,
    extractionRule: "project-type:family",
    sourceParser: document.parserSource,
    family,
    warnings: [materializeWarning("Project type inferred from document family signals.")],
  };
}

function mergeWarnings(fields: ProjectFactField<ProjectFactValue>[]): string[] {
  return dedupe(fields.flatMap((field) => field.warnings).filter(Boolean));
}

export function buildProjectFactContract(document: EvidenceDocument): ProjectFactContract {
  const family = document.documentFamily ?? "UNKNOWN";
  const title = findProjectTitle(document);
  const projectId = findField(document, FIELD_RULES.find((rule) => rule.field === "projectId") as FieldRule);
  const hostCountryRaw = findField(document, FIELD_RULES.find((rule) => rule.field === "hostCountry") as FieldRule);
  const hostCountry = hostCountryRaw.value != null
    ? hostCountryRaw
    : findFieldFromHeadingValue(document, FIELD_RULES.find((rule) => rule.field === "hostCountry") as FieldRule);
  const projectLocation = findField(document, FIELD_RULES.find((rule) => rule.field === "projectLocation") as FieldRule);
  const projectCountry = hostCountry.value
    ? hostCountry
    : deriveCountryFromLocation(projectLocation, family);
  const projectStandard = standardFact(document);
  const projectProponent = findField(document, FIELD_RULES.find((rule) => rule.field === "projectProponent") as FieldRule);
  const methodologyPrimaryRule = FIELD_RULES.find((rule) => rule.field === "methodologyPrimary") as FieldRule;
  const labeledMethodologyCandidates = findLabeledCandidates(document, methodologyPrimaryRule);
  // CDM PDDs define methodology in B.1 heading with the code in the body
  // paragraph that follows.  Prefer this over label-based candidates which
  // may match generic "methodology" text in B.2/B.7/B.8.
  const headingMethodologyFallback = family === "CDM_PDD"
    ? findMethodologyFromB1Heading(document, methodologyPrimaryRule)
    : createEmptyField<string | null>("methodology:heading-next", family, []);
  const methodologyPrimary = headingMethodologyFallback.value != null
    ? headingMethodologyFallback
    : factFromCandidates<string | null>(
        family,
        "methodologyPrimary",
        labeledMethodologyCandidates.length > 0
          ? labeledMethodologyCandidates
          : [
              ...labeledMethodologyCandidates,
              ...findMethodologyCodeFallbackCandidates(document),
            ],
        { allowMedium: true },
      );
  const baselineMethodology = findField(document, FIELD_RULES.find((rule) => rule.field === "baselineMethodology") as FieldRule);
  const monitoringMethodology = findField(document, FIELD_RULES.find((rule) => rule.field === "monitoringMethodology") as FieldRule);
  const creditingPeriod = findField(document, FIELD_RULES.find((rule) => rule.field === "creditingPeriod") as FieldRule);
  const reportingPeriod = findField(document, FIELD_RULES.find((rule) => rule.field === "reportingPeriod") as FieldRule);
  const monitoringPeriod = findField(document, FIELD_RULES.find((rule) => rule.field === "monitoringPeriod") as FieldRule);
  const projectStartDate = findField(document, FIELD_RULES.find((rule) => rule.field === "projectStartDate") as FieldRule);
  const projectType = inferProjectType(document);
  const methodologyModules = methodologyModulesFact(document, methodologyPrimary);

  if (title.value && methodologyPrimary.value && normalizeValue(title.value) === normalizeValue(methodologyPrimary.value)) {
    title.value = null;
    title.confidence = "low";
    title.warnings = dedupe([...title.warnings, materializeWarning("Title matched methodology text and was downgraded to unclear.")]);
  }

  if (creditingPeriod.value && reportingPeriod.value && normalizeValue(creditingPeriod.value) === normalizeValue(reportingPeriod.value)) {
    reportingPeriod.warnings = dedupe([...reportingPeriod.warnings, materializeWarning("Reporting period matched crediting period exactly; keeping fields separate but flagged for review.")]);
  }

  const baselineSections = sectionsFact(document, "baseline", [
    "baseline scenario",
    "baseline",
    "without-project land use scenario",
    "without project land use scenario",
    "without-project land use scenario and additionality",
    "without project land use scenario and additionality",
    "without-project scenario",
    "without project scenario",
  ]);
  const monitoringSections = sectionsFact(document, "monitoring", ["monitoring plan", "monitoring"]);
  const leakageSections = sectionsFact(document, "leakage", ["leakage", "leakage monitoring"]);
  const additionalitySections = sectionsFact(document, "additionality", [
    "additionality",
    "project is additional",
    "without-project land use scenario and additionality",
    "without project land use scenario and additionality",
  ]);

  const fields = [
    title,
    projectId,
    hostCountry,
    projectCountry,
    projectLocation,
    projectStandard,
    projectType,
    projectProponent,
    methodologyPrimary,
    methodologyModules as unknown as ProjectFactField,
    baselineMethodology,
    monitoringMethodology,
    creditingPeriod,
    reportingPeriod,
    monitoringPeriod,
    projectStartDate,
    baselineSections as unknown as ProjectFactField,
    monitoringSections as unknown as ProjectFactField,
    leakageSections as unknown as ProjectFactField,
    additionalitySections as unknown as ProjectFactField,
  ];

  return {
    documentFamily: family,
    documentType: chooseDocumentType(family),
    projectTitle: title,
    projectId,
    hostCountry,
    projectCountry,
    projectLocation,
    projectStandard,
    projectType,
    projectProponent,
    methodologyPrimary,
    methodologyModules,
    baselineMethodology,
    monitoringMethodology,
    creditingPeriod,
    reportingPeriod,
    monitoringPeriod,
    projectStartDate,
    baselineSections,
    monitoringSections,
    leakageSections,
    additionalitySections,
    warnings: mergeWarnings(fields),
  };
}
