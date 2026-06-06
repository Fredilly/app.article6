import { classifyMethodologyRoles } from "@/lib/chat/methodologyRoleClassifier";
import { extractDocumentFacts } from "@/lib/quickCheck/evidence/extractDocumentFacts";
import type {
  CanonicalProjectFactKey,
  EvidenceDocument,
  EvidenceSpan,
  ProjectFactConfidence,
  ProjectFactContract,
  ProjectFactValue,
  ProjectSectionFact,
} from "@/lib/quickCheck/evidence/evidenceTypes";

const DATE_PATTERN =
  /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/;

const STANDARD_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "VCS/Verra", pattern: /\b(?:verra|vcs)\b/i },
  { label: "CDM", pattern: /\b(?:cdm|clean development mechanism)\b/i },
  { label: "Gold Standard", pattern: /\bgold standard\b/i },
];

const DOCUMENT_TYPE_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "Monitoring Report", pattern: /\bmonitoring report\b/i },
  { label: "Project Design Document", pattern: /\bproject design document\b/i },
  { label: "Project Description Document", pattern: /\bproject description document\b|\bproject description\s*\/\s*pd\b/i },
  { label: "Project Document", pattern: /\bproject document\b/i },
];

const PROJECT_TYPE_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "REDD/AFOLU", pattern: /\b(?:redd\+?|afolu|forest conservation|peat swamp|mangrove restoration)\b/i },
  { label: "Energy", pattern: /\b(?:hydro|solar|wind|renewable|grid|power plant|small hydro)\b/i },
  { label: "Reforestation", pattern: /\b(?:reforestation|afforestation)\b/i },
];

const SECTION_RULES: Array<{ key: keyof Pick<ProjectFactContract, "baselineSections" | "monitoringSections" | "leakageSections" | "additionalitySections">; pattern: RegExp; rule: string }> = [
  { key: "baselineSections", pattern: /\bbaseline\b|without-project land use scenario/i, rule: "section_heading.baseline" },
  { key: "monitoringSections", pattern: /\bmonitoring\b/i, rule: "section_heading.monitoring" },
  { key: "leakageSections", pattern: /\bleakage\b/i, rule: "section_heading.leakage" },
  { key: "additionalitySections", pattern: /\badditionality\b/i, rule: "section_heading.additionality" },
];

function cleanValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.;:,]$/, "").trim();
}

function firstSpan(document: EvidenceDocument, spanIds: string[]): EvidenceSpan | null {
  return document.spans.find((span) => spanIds.includes(span.spanId)) ?? null;
}

function scalarFact<T = string>(
  span: EvidenceSpan | null,
  value: T | null,
  confidence: ProjectFactConfidence,
  extractionRule: string,
): ProjectFactValue<T> | null {
  if (!span || value == null) return null;
  return {
    value,
    confidence,
    evidenceSpanIds: [span.spanId],
    page: span.page,
    sectionId: span.sectionId,
    heading: span.heading,
    extractionRule,
  };
}

function maybeFromDocumentFact(
  document: EvidenceDocument,
  kind: Parameters<typeof extractDocumentFacts>[0] extends never ? never : string,
  key: CanonicalProjectFactKey,
  extractionRule: string,
): ProjectFactValue<string> | null {
  const fact = extractDocumentFacts(document).find((entry) => entry.kind === kind);
  if (!fact) return null;
  const span = firstSpan(document, fact.evidenceSpanIds);
  return scalarFact(span, fact.value, fact.confidence, extractionRule.replace("{key}", key));
}

function earlySpans(document: EvidenceDocument): EvidenceSpan[] {
  const spans: EvidenceSpan[] = [];
  for (const span of document.spans) {
    if (span.blockType === "toc" || span.blockType === "footer") continue;
    spans.push(span);
    if (spans.length >= 12) break;
  }
  return spans;
}

function findLabeledSpan(document: EvidenceDocument, labels: string[], extractionRule: string, pattern?: RegExp): ProjectFactValue<string> | null {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`^\\s*(?:${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i");

  for (const span of document.spans) {
    if (span.blockType === "toc" || span.blockType === "footer") continue;
    const match = span.text.match(regex);
    if (!match?.[1]) continue;
    const candidate = pattern?.exec(match[1])?.[0] ?? match[1];
    const value = cleanValue(candidate);
    if (!value) continue;
    return scalarFact(span, value, span.blockType === "field" ? "high" : "medium", extractionRule);
  }
  return null;
}

function buildStandardFact(document: EvidenceDocument): ProjectFactValue<string> | null {
  for (const span of earlySpans(document)) {
    for (const rule of STANDARD_RULES) {
      if (!rule.pattern.test(span.text)) continue;
      return scalarFact(span, rule.label, "medium", `standard.${rule.label.toLowerCase().replace(/\W+/g, "_")}`);
    }
  }
  return null;
}

function buildDocumentTypeFact(document: EvidenceDocument): ProjectFactValue<string> | null {
  for (const span of earlySpans(document)) {
    for (const rule of DOCUMENT_TYPE_RULES) {
      if (!rule.pattern.test(span.text)) continue;
      return scalarFact(span, rule.label, "high", `document_type.${rule.label.toLowerCase().replace(/\W+/g, "_")}`);
    }
  }
  return null;
}

function buildProjectTypeFact(document: EvidenceDocument, titleFact: ProjectFactValue<string> | null): ProjectFactValue<string> | null {
  const candidates = titleFact ? [titleFact] : [];
  for (const span of earlySpans(document)) {
    candidates.push({
      value: span.text,
      confidence: "medium",
      evidenceSpanIds: [span.spanId],
      page: span.page,
      sectionId: span.sectionId,
      heading: span.heading,
      extractionRule: "project_type.early_span",
    });
  }

  for (const candidate of candidates) {
    for (const rule of PROJECT_TYPE_RULES) {
      if (!rule.pattern.test(candidate.value)) continue;
      return {
        ...candidate,
        value: rule.label,
        extractionRule: `project_type.${rule.label.toLowerCase().replace(/\W+/g, "_")}`,
      };
    }
  }
  return null;
}

function buildMethodologyPrimaryFact(document: EvidenceDocument): ProjectFactValue<string> | null {
  const classified = classifyMethodologyRoles(document.rawText);
  const primary = classified.primaryMethodology;
  if (primary) {
    const value = [primary.id, primary.version ? `Version ${primary.version}` : null].filter(Boolean).join(" ");
    const span = document.spans.find((candidate) => candidate.text.includes(primary.id)) ?? null;
    return scalarFact(span, cleanValue(value), primary.confidence, "methodology_role.primary");
  }

  return maybeFromDocumentFact(document, "methodology", "methodologyPrimary", "document_fact.{key}")
    ?? maybeFromDocumentFact(document, "baseline_methodology", "methodologyPrimary", "document_fact.{key}");
}

function buildMethodologyModuleFacts(document: EvidenceDocument): Array<ProjectFactValue<string>> {
  const classified = classifyMethodologyRoles(document.rawText);
  return classified.referencedMethods
    .filter((entry) => entry.role === "TOOL_OR_DEPENDENCY")
    .map((entry) => {
      const span = document.spans.find((candidate) => candidate.text.includes(entry.id)) ?? null;
      return scalarFact(span, entry.id, entry.confidence, "methodology_role.module");
    })
    .filter((entry): entry is ProjectFactValue<string> => Boolean(entry));
}

function buildProjectStartDateFact(document: EvidenceDocument): ProjectFactValue<string> | null {
  return findLabeledSpan(
    document,
    ["Project start date", "Start date", "Date of commencement", "Project commencement date"],
    "project_start_date.labeled",
    DATE_PATTERN,
  );
}

function buildProjectCountryFact(
  hostCountry: ProjectFactValue<string> | null,
  location: ProjectFactValue<string> | null,
  title: ProjectFactValue<string> | null,
): ProjectFactValue<string> | null {
  if (hostCountry) return { ...hostCountry, extractionRule: "project_country.from_host_country" };
  if (location) return { ...location, extractionRule: "project_country.from_project_location" };
  if (title) {
    const match = title.value.match(/\b(?:in|of)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})$/);
    if (match?.[1]) {
      return {
        ...title,
        value: cleanValue(match[1]),
        confidence: "low",
        extractionRule: "project_country.title_suffix",
      };
    }
  }
  return null;
}

function buildProjectProponentFact(document: EvidenceDocument): ProjectFactValue<string> | null {
  return findLabeledSpan(
    document,
    ["Project proponent", "Project participants", "Project participant", "Project developer"],
    "project_proponent.labeled",
  ) ?? maybeFromDocumentFact(document, "project_participants", "projectProponent", "document_fact.{key}");
}

function buildSectionFacts(document: EvidenceDocument): Pick<ProjectFactContract, "baselineSections" | "monitoringSections" | "leakageSections" | "additionalitySections"> {
  const result = {
    baselineSections: [] as Array<ProjectSectionFact>,
    monitoringSections: [] as Array<ProjectSectionFact>,
    leakageSections: [] as Array<ProjectSectionFact>,
    additionalitySections: [] as Array<ProjectSectionFact>,
  };

  const seen = new Set<string>();
  for (const span of document.spans) {
    if (span.blockType !== "section_heading") continue;
    const label = cleanValue(span.text);
    for (const rule of SECTION_RULES) {
      if (!rule.pattern.test(span.text) && !rule.pattern.test(span.heading ?? "")) continue;
      const key = `${rule.key}:${span.sectionId ?? ""}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result[rule.key].push({
        value: label,
        confidence: "high",
        evidenceSpanIds: [span.spanId],
        page: span.page,
        sectionId: span.sectionId,
        heading: span.heading ?? label,
        extractionRule: rule.rule,
      });
    }
  }

  return result;
}

export function buildProjectFactContract(document: EvidenceDocument): ProjectFactContract {
  const projectTitle = maybeFromDocumentFact(document, "project_title", "projectTitle", "document_fact.{key}");
  const hostCountry = maybeFromDocumentFact(document, "host_country", "hostCountry", "document_fact.{key}");
  const projectLocation = maybeFromDocumentFact(document, "project_location", "projectCountry", "document_fact.projectLocation");
  const creditingPeriod = maybeFromDocumentFact(document, "crediting_period", "creditingPeriod", "document_fact.{key}");
  const methodologyPrimary = buildMethodologyPrimaryFact(document);
  const projectStandard = buildStandardFact(document);
  const documentType = buildDocumentTypeFact(document);
  const projectType = buildProjectTypeFact(document, projectTitle);
  const projectStartDate = buildProjectStartDateFact(document);
  const projectProponent = buildProjectProponentFact(document);
  const sectionFacts = buildSectionFacts(document);

  return {
    projectTitle,
    hostCountry,
    projectCountry: buildProjectCountryFact(hostCountry, projectLocation, projectTitle),
    projectStandard,
    documentType,
    methodologyPrimary,
    methodologyModules: buildMethodologyModuleFacts(document),
    projectType,
    projectStartDate,
    creditingPeriod,
    projectProponent,
    baselineSections: sectionFacts.baselineSections,
    monitoringSections: sectionFacts.monitoringSections,
    leakageSections: sectionFacts.leakageSections,
    additionalitySections: sectionFacts.additionalitySections,
  };
}
