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
    labels: ["Host country", "Host country(ies)", "Country", "Host Party"],
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
    preferBlockTypes: ["field", "table", "paragraph"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Project location", "Geographic reference of the project activity", "Geographic location"],
      VERRA_PD: ["Project location", "Geographic reference of the project activity", "Geographic location"],
      REDD_AFOLU: ["Project location", "Geographic reference", "Geographic location"],
    },
  },
  {
    field: "projectProponent",
    labels: ["Project proponent", "Project participants", "Participants"],
    preferBlockTypes: ["field", "table", "paragraph"],
    multiline: true,
  },
  {
    field: "methodologyPrimary",
    labels: ["Methodology", "Applied methodology", "Approved methodology"],
    preferBlockTypes: ["field", "table", "paragraph"],
    multiline: true,
    familySpecificLabels: {
      VCS_PD: ["Title and reference of methodology applied", "Methodology applied"],
      VERRA_PD: ["Title and reference of methodology applied", "Methodology applied"],
      CDM_PDD: ["Applied baseline methodology", "Approved baseline and monitoring methodology"],
    },
  },
  {
    field: "baselineMethodology",
    labels: ["Baseline methodology", "Applied baseline methodology"],
    preferBlockTypes: ["field", "table", "paragraph"],
    multiline: true,
  },
  {
    field: "monitoringMethodology",
    labels: ["Monitoring methodology", "Monitoring approach"],
    preferBlockTypes: ["field", "table", "paragraph"],
    multiline: true,
  },
  {
    field: "creditingPeriod",
    labels: ["Crediting period", "Project crediting period", "Crediting period of the project activity"],
    preferBlockTypes: ["field", "paragraph"],
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
  // Strict: label at start of line (matches classic field-name: value patterns)
  const strictPattern = new RegExp(
    `^\\s*(?:${labels.map(escapeRegExp).join("|")})\\s*[:\\-]\\s*(.+)$`,
    "i",
  );
  // Relaxed: label anywhere in the span, preceded by word boundary
  // (catches labels after section numbers like \"1.2 Geographic location: ...\")
  const relaxedPattern = document.documentFamily
    ? new RegExp(
        `\\b(?:${labels.map(escapeRegExp).join("|")})\\s*[:\\-]\\s*(.+)$`,
        "im",
      )
    : null;

  const results: Candidate[] = [];
  const seenValues = new Set<string>();

  for (const span of document.spans.filter((s) => s.reliability !== "excluded")) {
    if (rule.preferBlockTypes && !rule.preferBlockTypes.includes(span.blockType)) continue;

    // Try strict first, then relaxed
    for (const pattern of [strictPattern, relaxedPattern].filter(Boolean) as RegExp[]) {
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
      break; // first match per span
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
  const segments = field.value.split(/[;,]/).map((segment) => segment.trim()).filter(Boolean);
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
  const headingMatches = document.spans.filter((span) => (
    span.reliability !== "excluded"
    && span.blockType === "section_heading"
    && terms.some((term) => (
      span.normalizedText.includes(normalizeValue(term))
      || span.headingPath.some((heading) => normalizeValue(heading).includes(normalizeValue(term)))
      || normalizeValue(span.heading ?? "").includes(normalizeValue(term))
    ))
  ));
  const bodyMatches = document.spans.filter((span) => (
    span.reliability !== "excluded"
    && (span.blockType === "paragraph" || span.blockType === "field")
    && terms.some((term) => span.headingPath.some((heading) => normalizeValue(heading).includes(normalizeValue(term))))
  ));
  const matches = headingMatches.length > 0 ? headingMatches : bodyMatches;

  if (matches.length === 0) {
    return createEmptyField<string[] | null>(`sections:${fieldName}`, family, [materializeWarning(`No ${fieldName} sections were found.`)]);
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
  const hostCountry = findField(document, FIELD_RULES.find((rule) => rule.field === "hostCountry") as FieldRule);
  const projectLocation = findField(document, FIELD_RULES.find((rule) => rule.field === "projectLocation") as FieldRule);
  const projectCountry = hostCountry.value
    ? hostCountry
    : deriveCountryFromLocation(projectLocation, family);
  const projectStandard = standardFact(document);
  const projectProponent = findField(document, FIELD_RULES.find((rule) => rule.field === "projectProponent") as FieldRule);
  const methodologyPrimaryRule = FIELD_RULES.find((rule) => rule.field === "methodologyPrimary") as FieldRule;
  const labeledMethodologyCandidates = findLabeledCandidates(document, methodologyPrimaryRule);
  const methodologyPrimary = factFromCandidates<string | null>(
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
  ]);
  const monitoringSections = sectionsFact(document, "monitoring", ["monitoring plan", "monitoring"]);
  const leakageSections = sectionsFact(document, "leakage", ["leakage"]);
  const additionalitySections = sectionsFact(document, "additionality", ["additionality", "project is additional"]);

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
