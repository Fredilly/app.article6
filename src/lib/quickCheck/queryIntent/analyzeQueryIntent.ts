import { findBestTopicMatch } from "@/lib/quickCheck/indexing";
import type { SectionTopic, SectionTableIndex } from "@/lib/quickCheck/indexing";
import type {
  ProjectFactId,
  QueryIntentAnalysis,
  QueryIntentAnalyzerInput,
} from "@/lib/quickCheck/queryIntent/types";

const FACT_RULES: Array<{
  factId: ProjectFactId;
  aliases: string[];
  negatives?: string[];
}> = [
  { factId: "projectTitle", aliases: ["project title", "title of the project", "name of the project", "project name"], negatives: ["methodology"] },
  { factId: "hostCountry", aliases: ["host country", "country host", "project hosted in", "country is this project", "country is the project"] },
  { factId: "projectCountry", aliases: ["project country", "country of the project", "country is the project"] },
  { factId: "projectLocation", aliases: ["project location", "where is the project located", "where is this project", "project area"] },
  { factId: "projectStandard", aliases: ["project standard", "standard", "registry standard"] },
  { factId: "projectType", aliases: ["project type", "type of project", "project activity", "activity described", "activity is described"] },
  { factId: "projectProponent", aliases: ["project proponent", "project developer", "participants", "project participants", "project participant", "who owns this project", "who is responsible", "responsible for implementation", "owns this project", "project owner"] },
  { factId: "methodologyPrimary", aliases: ["methodology", "primary methodology", "method used", "which methodology", "what methodology"] },
  { factId: "creditingPeriod", aliases: ["crediting period"] },
  { factId: "reportingPeriod", aliases: ["reporting period"] },
  { factId: "monitoringPeriod", aliases: ["monitoring period"] },
  { factId: "projectStartDate", aliases: ["project start date", "start date", "when did the project start", "project began", "project commenced"] },
  { factId: "baselineSections", aliases: ["baseline section", "baseline sections"] },
  { factId: "monitoringSections", aliases: ["monitoring section", "monitoring sections"] },
  { factId: "leakageSections", aliases: ["leakage section", "leakage sections"] },
  { factId: "additionalitySections", aliases: ["additionality section", "additionality sections"] },
];

const SECTION_TOPIC_RULES: Array<{
  topic: SectionTopic;
  aliases: string[];
  negatives?: string[];
}> = [
  { topic: "baseline", aliases: ["baseline", "without project", "without-project", "baseline scenario"], negatives: ["additionality", "monitoring", "leakage"] },
  { topic: "monitoring", aliases: ["monitoring", "monitoring plan", "monitoring methodology"], negatives: ["baseline", "additionality"] },
  { topic: "leakage", aliases: ["leakage", "activity shifting"], negatives: ["additionality", "baseline"] },
  { topic: "additionality", aliases: ["additionality", "additional"], negatives: ["baseline", "monitoring"] },
  { topic: "methodology", aliases: ["methodology", "methodological", "applied methodology"] },
  { topic: "project_location", aliases: ["project location", "location", "host country", "project area", "where is this project", "where is the project located"] },
  { topic: "project_participants", aliases: ["project participant", "project participants", "project proponent", "developer"] },
  { topic: "safeguards", aliases: ["safeguards", "grievance", "stakeholder", "fpic"] },
  { topic: "sdg", aliases: ["sdg", "sustainable development", "co-benefits"] },
];

const UNSUPPORTED_PATTERNS = [
  /\b(stock price|share price|market cap|ceo|founder net worth)\b/i,
  /\bweather\b/i,
  /\bpersonal opinion\b/i,
  /\blegal advice\b/i,
  /\binvestment return\b/i,
];

const TABLE_TERMS = ["table", "row", "column", "cell", "tabular"];
const METHODOLOGY_TERMS = ["methodology", "methodological", "module", "vm0007", "ams-", "tool"];
const CALCULATION_TERMS = ["calculate", "calculation", "formula", "equation", "compute", "tco2", "emission factor", "baseline emissions"];
const DIRECT_SECTION_RE = /\bsection\s+((?:[A-Z]\.\d+(?:\.\d+)*)|\d+(?:\.\d+)*)\b/i;
const FACT_QUESTION_RE = /^(what is|what are|who is|who are|when is|when are|where is|where are|which|name)\b/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s.+-]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function directSectionMatches(index: SectionTableIndex, normalizedQuery: string): string[] {
  const sectionRef = normalizedQuery.match(DIRECT_SECTION_RE)?.[1];
  if (!sectionRef) return [];
  return Object.values(index.sectionTree.nodesById)
    .filter((node) => normalize(node.sectionNumber ?? "") === normalize(sectionRef))
    .map((node) => node.sectionId ?? "")
    .filter(Boolean);
}

function scoreFactMatches(normalizedQuery: string): Array<{ factId: ProjectFactId; score: number; aliases: string[]; negatives: string[] }> {
  return FACT_RULES.map((rule) => {
    const aliasHits = rule.aliases.filter((alias) => normalizedQuery.includes(alias));
    const negativeHits = (rule.negatives ?? []).filter((term) => normalizedQuery.includes(term));
    return {
      factId: rule.factId,
      score: aliasHits.length * 3 - negativeHits.length,
      aliases: aliasHits,
      negatives: negativeHits,
    };
  }).filter((match) => match.score > 0);
}

function scoreSectionTopicMatches(index: SectionTableIndex, normalizedQuery: string) {
  return SECTION_TOPIC_RULES.map((rule) => {
    const aliasHits = rule.aliases.filter((alias) => normalizedQuery.includes(alias));
    const negativeHits = (rule.negatives ?? []).filter((term) => normalizedQuery.includes(term));
    const bestMatch = aliasHits.length > 0 ? findBestTopicMatch(rule.topic, index.sectionTopicMap, {
      minConfidence: 0.8,
      ambiguityMargin: 0.05,
    }) : { status: "no_evidence" as const, reason: "no_topic_references" as const };
    return {
      topic: rule.topic,
      score: aliasHits.length * 3 - negativeHits.length + (bestMatch.status === "matched" ? bestMatch.reference.confidence : 0),
      aliases: aliasHits,
      negatives: negativeHits,
      bestMatch,
    };
  }).filter((match) => match.score > 0);
}

function tableMatches(index: SectionTableIndex, normalizedQuery: string) {
  const queryTerms = normalizedQuery.split(" ").filter((term) => term.length >= 4);
  const tableSignals = index.tableIndex.tables.map((table) => {
    const headingText = normalize(`${table.heading ?? ""} ${table.tableId ?? ""}`);
    const cellHits = table.cells.filter((cell) => (
      queryTerms.some((term) => cell.normalizedText.includes(term))
    ));
    const headingHits = queryTerms.filter((term) => headingText.includes(term));
    return {
      table,
      score: headingHits.length * 2 + cellHits.length + (includesAny(normalizedQuery, TABLE_TERMS) ? 2 : 0),
      cellHits,
      headingHits,
    };
  }).filter((match) => match.score > 0);

  return tableSignals.sort((a, b) => b.score - a.score);
}

function makeAnalysis(base: Partial<QueryIntentAnalysis> & Pick<QueryIntentAnalysis, "intent">): QueryIntentAnalysis {
  return {
    intent: base.intent,
    targetFacts: base.targetFacts ?? [],
    targetSections: base.targetSections ?? [],
    targetTables: base.targetTables ?? [],
    targetCells: base.targetCells ?? [],
    positiveTerms: unique(base.positiveTerms ?? []),
    negativeTerms: unique(base.negativeTerms ?? []),
    calculationSpecific: base.calculationSpecific ?? false,
    unsupportedTopic: base.unsupportedTopic ?? false,
    confidence: base.confidence ?? 0,
    documentFamily: base.documentFamily,
  };
}

function withFamilyConfidenceCap(confidence: number, documentFamily?: SectionTableIndex["documentFamily"]): number {
  if (documentFamily === "UNKNOWN") return Math.min(confidence, 0.7);
  return confidence;
}

export function analyzeQueryIntent(input: QueryIntentAnalyzerInput): QueryIntentAnalysis {
  const normalizedQuery = normalize(input.query);
  const index = input.sectionTableIndex as SectionTableIndex;
  const calculationSpecific = includesAny(normalizedQuery, CALCULATION_TERMS) && normalizedQuery.includes("baseline");

  if (!normalizedQuery) {
    return makeAnalysis({
      intent: "ambiguous",
      confidence: 0.1,
      documentFamily: index.documentFamily,
    });
  }

  if (UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    return makeAnalysis({
      intent: "unsupported_or_out_of_scope",
      unsupportedTopic: true,
      confidence: 0.98,
      positiveTerms: [],
      negativeTerms: [],
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  const directSections = directSectionMatches(index, normalizedQuery);
  if (directSections.length > 0) {
    return makeAnalysis({
      intent: "section_topic",
      targetSections: directSections,
      positiveTerms: [normalizedQuery.match(DIRECT_SECTION_RE)?.[1] ?? ""],
      confidence: 0.97,
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  const factMatches = scoreFactMatches(normalizedQuery);
  const topicMatches = scoreSectionTopicMatches(index, normalizedQuery);
  const tableSignals = tableMatches(index, normalizedQuery);
  const wantsMethodology = includesAny(normalizedQuery, METHODOLOGY_TERMS);
  const wantsTable = includesAny(normalizedQuery, TABLE_TERMS);
  const factQuestionFrame = FACT_QUESTION_RE.test(normalizedQuery);

  const topFactScore = factMatches[0]?.score ?? 0;
  const topTopicScore = topicMatches[0]?.score ?? 0;
  const topTableScore = tableSignals[0]?.score ?? 0;
  const topScores = [
    { kind: "fact" as const, score: topFactScore },
    { kind: "topic" as const, score: topTopicScore },
    { kind: "table" as const, score: topTableScore },
  ].sort((a, b) => b.score - a.score);

  if (
    wantsMethodology
    && !wantsTable
    && !topicMatches.some((match) => match.topic === "baseline" && match.score > 0)
    && factMatches.some((match) => match.factId === "methodologyPrimary" && match.score > 0)
  ) {
    const methodologyFacts: ProjectFactId[] = ["methodologyPrimary", "methodologyModules", "baselineMethodology", "monitoringMethodology"];
    const methodologySections = topicMatches.flatMap((match) => {
      if (match.topic !== "methodology" || match.bestMatch.status !== "matched") return [];
      return match.bestMatch.reference.sectionId ? [match.bestMatch.reference.sectionId] : [];
    });

    return makeAnalysis({
      intent: "methodology_lookup",
      targetFacts: methodologyFacts,
      targetSections: unique(methodologySections),
      positiveTerms: unique([
        ...FACT_RULES.filter((rule) => methodologyFacts.includes(rule.factId)).flatMap((rule) => rule.aliases),
        "methodology",
      ]),
      confidence: withFamilyConfidenceCap(
        methodologySections.length > 0 ? 0.94 : 0.86,
        index.documentFamily,
      ),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (
    !factQuestionFrame
    && topScores[0].score > 0
    && topScores[1].score > 0
    && Math.abs(topScores[0].score - topScores[1].score) < 0.35
  ) {
    return makeAnalysis({
      intent: "ambiguous",
      confidence: 0.45,
      positiveTerms: unique([
        ...factMatches.flatMap((match) => match.aliases),
        ...topicMatches.flatMap((match) => match.aliases),
      ]),
      negativeTerms: unique([
        ...factMatches.flatMap((match) => match.negatives),
        ...topicMatches.flatMap((match) => match.negatives),
      ]),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (wantsTable || topTableScore > topFactScore + 0.5 || topTableScore > topTopicScore + 0.5) {
    const topTables = (tableSignals.length > 0 ? tableSignals : index.tableIndex.tables.map((table) => ({
      table,
      score: wantsTable ? 1 : 0,
      cellHits: [],
      headingHits: [],
    }))).slice(0, 3);
    if (topTables.length === 0) {
      return makeAnalysis({
        intent: "unsupported_or_out_of_scope",
        unsupportedTopic: true,
        confidence: 0.75,
        calculationSpecific,
        documentFamily: index.documentFamily,
      });
    }
    return makeAnalysis({
      intent: "table_lookup",
      targetTables: topTables.map((entry) => entry.table.tableId ?? entry.table.evidenceSpanId),
      targetSections: unique(topTables.map((entry) => entry.table.sectionId ?? "").filter(Boolean)),
      targetCells: topTables.flatMap((entry) => entry.cellHits.slice(0, 5).map((cell) => ({
        sourceTableId: cell.sourceTableId,
        sourceBlockId: cell.sourceBlockId,
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        text: cell.text,
      }))),
      positiveTerms: unique([
        ...topTables.flatMap((entry) => entry.headingHits),
        ...queryWordTerms(normalizedQuery),
      ]),
      confidence: withFamilyConfidenceCap(
        Math.min(0.97, 0.7 + (topTables[0]?.score ?? 0) * 0.04),
        index.documentFamily,
      ),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (wantsMethodology && topicMatches.some((match) => match.topic === "baseline" && match.score > 0)) {
    return makeAnalysis({
      intent: "ambiguous",
      confidence: 0.48,
      positiveTerms: unique([
        ...topicMatches.flatMap((match) => match.aliases),
        ...factMatches.flatMap((match) => match.aliases),
      ]),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (factMatches.length > 0 && (factQuestionFrame || topFactScore >= topTopicScore)) {
    const primaryFacts = factMatches.filter((match) => match.score >= topFactScore - 1).map((match) => match.factId);
    // Location queries: fall back to hostCountry / projectCountry when
    // the specific projectLocation fact has no extracted evidence.
    const locationFallbackFacts: ProjectFactId[] = [];
    if (primaryFacts.some((f) => f === "projectLocation")) {
      locationFallbackFacts.push("hostCountry", "projectCountry");
    }
    return makeAnalysis({
      intent: "fact_lookup",
      targetFacts: unique([...primaryFacts, ...locationFallbackFacts]),
      positiveTerms: factMatches.flatMap((match) => match.aliases),
      negativeTerms: factMatches.flatMap((match) => match.negatives),
      confidence: withFamilyConfidenceCap(
        Math.min(0.98, 0.75 + topFactScore * 0.05),
        index.documentFamily,
      ),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (wantsMethodology) {
    const methodologyFacts: ProjectFactId[] = ["methodologyPrimary", "methodologyModules", "baselineMethodology", "monitoringMethodology"];
    const methodologySections = topicMatches.flatMap((match) => {
      if (match.topic !== "methodology" || match.bestMatch.status !== "matched") return [];
      return match.bestMatch.reference.sectionId ? [match.bestMatch.reference.sectionId] : [];
    });

    return makeAnalysis({
      intent: "methodology_lookup",
      targetFacts: methodologyFacts,
      targetSections: unique(methodologySections),
      positiveTerms: unique([
        ...FACT_RULES.filter((rule) => methodologyFacts.includes(rule.factId)).flatMap((rule) => rule.aliases),
        "methodology",
      ]),
      confidence: withFamilyConfidenceCap(
        methodologySections.length > 0 ? 0.94 : 0.86,
        index.documentFamily,
      ),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  if (topTopicScore > 0) {
    const matchedTopics = topicMatches.filter((match) => match.bestMatch.status === "matched");
    if (matchedTopics.length === 0) {
      return makeAnalysis({
        intent: "ambiguous",
        confidence: 0.4,
        positiveTerms: topicMatches.flatMap((match) => match.aliases),
        calculationSpecific,
        documentFamily: index.documentFamily,
      });
    }
    return makeAnalysis({
      intent: "section_topic",
      targetSections: unique(matchedTopics.map((match) => match.bestMatch.status === "matched" ? match.bestMatch.reference.sectionId ?? "" : "").filter(Boolean)),
      positiveTerms: matchedTopics.flatMap((match) => match.aliases),
      negativeTerms: matchedTopics.flatMap((match) => match.negatives),
      confidence: withFamilyConfidenceCap(
        Math.min(0.96, 0.72 + topTopicScore * 0.05),
        index.documentFamily,
      ),
      calculationSpecific,
      documentFamily: index.documentFamily,
    });
  }

  return makeAnalysis({
    intent: "unsupported_or_out_of_scope",
    unsupportedTopic: true,
    confidence: 0.7,
    calculationSpecific,
    documentFamily: index.documentFamily,
  });
}

function queryWordTerms(normalizedQuery: string): string[] {
  return normalizedQuery.split(" ").filter((term) => term.length >= 4);
}
