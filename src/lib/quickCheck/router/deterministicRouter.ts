import type { EvidenceDocument, EvidenceSpan, QuoteValidationInput } from "@/lib/quickCheck/evidence/evidenceTypes";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";
import { buildEvidenceSpanIndex } from "@/lib/quickCheck/evidence/buildEvidenceSpanIndex";
import type { SectionNode, SectionTableIndex, TableCellReference, IndexedTable } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract, ProjectFactField, ProjectFactConfidence, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";
import type { QueryIntentAnalysis, ProjectFactId } from "@/lib/quickCheck/queryIntent";
import type {
  DeterministicRouterResult,
  DeterministicRouterRoute,
  ReviewArea,
} from "@/lib/quickCheck/retrieval/types";

type RouterCandidate = {
  answerText: string;
  route: Exclude<DeterministicRouterRoute, "fallback">;
  confidence: number;
  evidenceSpanIds: string[];
  quoteInputs: QuoteValidationInput[];
  answerQuoteCount: number;
  pages: number[];
  sectionPaths: string[];
  warnings: string[];
  isStructuredInput: boolean;
};

type DeterministicRouterInput = {
  claimText: string;
  reviewArea: ReviewArea;
  queryIntentAnalysis?: QueryIntentAnalysis;
  evidenceDocument?: EvidenceDocument;
  projectFactContract?: ProjectFactContract;
  sectionTableIndex?: SectionTableIndex;
};

const ANSWER_CONFIDENCE_THRESHOLD = 0.7;
const LEXICAL_MIN_CONFIDENCE = 0.74;

const MAX_QUOTES = 2;

const FACT_LABELS: Record<ProjectFactId, string> = {
  projectTitle: "Project title",
  projectId: "Project ID",
  hostCountry: "Host country",
  projectCountry: "Project country",
  projectLocation: "Project location",
  projectStandard: "Project standard",
  projectType: "Project type",
  projectProponent: "Project proponent",
  methodologyPrimary: "Primary methodology",
  methodologyModules: "Methodology modules",
  baselineMethodology: "Baseline methodology",
  monitoringMethodology: "Monitoring methodology",
  creditingPeriod: "Crediting period",
  reportingPeriod: "Reporting period",
  monitoringPeriod: "Monitoring period",
  projectStartDate: "Project start date",
  baselineSections: "Baseline sections",
  monitoringSections: "Monitoring sections",
  leakageSections: "Leakage sections",
  additionalitySections: "Additionality sections",
};

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeConfidence(confidence: ProjectFactConfidence): number {
  switch (confidence) {
    case "high":
      return 0.95;
    case "medium":
      return 0.8;
    case "low":
    default:
      return 0.62;
  }
}

function formatFactValue(value: ProjectFactValue): string | null {
  if (Array.isArray(value)) {
    const compact = value.map((entry) => entry.trim()).filter(Boolean);
    return compact.length > 0 ? compact.join(", ") : null;
  }
  if (typeof value === "string") {
    const compact = value.trim();
    return compact.length > 0 ? compact : null;
  }
  return null;
}

function formatSectionPath(path: string[]): string {
  return path.join(" > ");
}

function formatHeadingPath(path: string[]): string {
  return path.join(" > ");
}

function getSpanLookup(document: EvidenceDocument): Map<string, EvidenceSpan> {
  return new Map(document.spans.map((span) => [span.spanId, span]));
}

function buildFallback(input: {
  answerText: string;
  status: DeterministicRouterResult["status"];
  confidence: number;
  warnings?: string[];
}): DeterministicRouterResult {
  return {
    answerText: input.answerText,
    status: input.status,
    route: "fallback",
    confidence: clampConfidence(input.confidence),
    evidenceSpanIds: [],
    quotes: [],
    pages: [],
    sectionPaths: [],
    warnings: input.warnings ?? [],
  };
}

function finalizeCandidate(document: EvidenceDocument, candidate: RouterCandidate): DeterministicRouterResult {
  const validations = validateQuotes(document, candidate.quoteInputs);
  const validQuotes = validations
    .map((validation, index) => ({ validation, quoteInput: candidate.quoteInputs[index] }))
    .filter((entry): entry is { validation: NonNullable<typeof validations[number]>; quoteInput: QuoteValidationInput } => entry.validation.valid);
  const requiredValidatedQuotes = Math.max(1, Math.min(candidate.answerQuoteCount, candidate.quoteInputs.length));
  if (validQuotes.length < requiredValidatedQuotes) {
    return buildFallback({
      answerText: "Quick Check found a possible evidence path but could not validate the supporting quotes against source spans.",
      status: "unclear",
      confidence: candidate.confidence,
      warnings: [...candidate.warnings, "quote_validation_failed"],
    });
  }

  const matchedSpanIds = dedupe(validQuotes.flatMap(({ validation }) => validation.matchedSpanIds));
  const spanLookup = getSpanLookup(document);
  const pages = dedupe([
    ...matchedSpanIds
      .map((spanId) => spanLookup.get(spanId)?.page)
      .filter((page): page is number => typeof page === "number"),
  ]).sort((left, right) => left - right);
  const sectionPaths = dedupe([
    ...candidate.sectionPaths,
    ...matchedSpanIds
      .map((spanId) => spanLookup.get(spanId)?.sectionPath ?? [])
      .filter((path) => path.length > 0)
      .map((path) => formatSectionPath(path)),
  ]);
  const headingPaths = dedupe(matchedSpanIds
    .map((spanId) => spanLookup.get(spanId)?.headingPath ?? [])
    .filter((path) => path.length > 0)
    .map((path) => formatHeadingPath(path)));
  const structuralPaths = sectionPaths.length > 0
    ? sectionPaths
    : headingPaths.length > 0
      ? headingPaths
      : pages.length > 0
        ? ["Document root"]
        : [];
  const quotes = dedupe(validQuotes.map(({ quoteInput }) => quoteInput.quote));

  if (matchedSpanIds.length === 0 || quotes.length === 0 || pages.length === 0 || structuralPaths.length === 0) {
    return buildFallback({
      answerText: "Quick Check found a possible evidence path but could not preserve the grounded provenance required for a deterministic answer.",
      status: "unclear",
      confidence: candidate.confidence,
      warnings: [...candidate.warnings, "missing_grounded_provenance"],
    });
  }

  return {
    answerText: candidate.answerText,
    status: candidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD ? "answered" : "unclear",
    route: candidate.route,
    confidence: clampConfidence(candidate.confidence),
    evidenceSpanIds: matchedSpanIds,
    quotes,
    pages,
    sectionPaths: structuralPaths,
    warnings: candidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD
      ? candidate.warnings
      : [...candidate.warnings, "low_confidence"],
  };
}

function buildFactCandidate(input: DeterministicRouterInput): RouterCandidate | null {
  if (!input.evidenceDocument || !input.projectFactContract || !input.queryIntentAnalysis) return null;
  if (!["fact_lookup", "methodology_lookup"].includes(input.queryIntentAnalysis.intent)) return null;

  const spanLookup = getSpanLookup(input.evidenceDocument);
  const intent = input.queryIntentAnalysis.intent;
  const targetFacts = input.queryIntentAnalysis.targetFacts;

  // Determine which resolved facts to include in the answer.
  // Methodology queries should only show methodology facts, not
  // unrelated facts (location, crediting period etc.) that happen
  // to share the same evidence span.
  const relevantFactIds: ProjectFactId[] = [];
  if (intent === "methodology_lookup") {
    relevantFactIds.push("methodologyPrimary");
  }
  if (intent === "fact_lookup") {
    relevantFactIds.push(...targetFacts);
  }
  // Ensure we have at least the target facts
  if (relevantFactIds.length === 0) relevantFactIds.push(...targetFacts);

  const resolvedFacts = relevantFactIds
    .filter((factId) => input.projectFactContract?.[factId])
    .map((factId) => ({
      factId,
      field: input.projectFactContract![factId],
      value: formatFactValue(input.projectFactContract![factId].value ?? null),
    }))
    .filter((entry): entry is {
      factId: ProjectFactId;
      field: ProjectFactField;
      value: string;
    } => {
      const field = entry.field;
      if (!field || !entry.value) return false;
      return field.evidenceSpanIds.length > 0 || field.extractionRule === "structured-input";
    })
    .map((entry) => {
      if (entry.field.extractionRule === "structured-input") {
        return {
          ...entry,
          supportingSpans: [] as EvidenceSpan[],
          isStructuredInput: true as const,
        };
      }
      const supportingSpans = entry.field.evidenceSpanIds
        .map((spanId) => spanLookup.get(spanId))
        .filter((span): span is EvidenceSpan => Boolean(span))
        .filter((span) => normalize(span.text).includes(normalize(entry.value)));
      return {
        ...entry,
        supportingSpans,
        isStructuredInput: false as const,
      };
    })
    .filter((entry): entry is {
      factId: ProjectFactId;
      field: ProjectFactField;
      value: string;
      supportingSpans: EvidenceSpan[];
      isStructuredInput: boolean;
    } => entry.isStructuredInput || entry.supportingSpans.length > 0);

  // ── Related-fact fallback ──────────────────────────────────────────────
  // When the exact fact is not found, try related facts and compose a
  // partial/related answer with a caveat.
  let answerCaveat: string | undefined;
  if (resolvedFacts.length === 0 && intent === "fact_lookup") {
    const fallbackMap: Record<string, ProjectFactId[]> = {
      creditingPeriod: ["reportingPeriod", "monitoringPeriod"],
      hostCountry: ["projectCountry"],
      projectLocation: ["hostCountry", "projectCountry"],
    };
    for (const targetFact of targetFacts) {
      const fallbacks = fallbackMap[targetFact] ?? [];
      for (const fallbackId of fallbacks) {
        const fallbackField = input.projectFactContract?.[fallbackId];
        const fallbackValue = formatFactValue(fallbackField?.value ?? null);
        if (fallbackField && fallbackValue && (fallbackField.evidenceSpanIds.length > 0 || fallbackField.extractionRule === "structured-input")) {
          const fallbackSpans = fallbackField.evidenceSpanIds
            .map((spanId) => spanLookup.get(spanId))
            .filter((span): span is EvidenceSpan => Boolean(span))
            .filter((span) => normalize(span.text).includes(normalize(fallbackValue)));
          resolvedFacts.push({
            factId: fallbackId,
            field: fallbackField as ProjectFactField,
            value: fallbackValue,
            supportingSpans: fallbackSpans,
            isStructuredInput: fallbackField.extractionRule === "structured-input",
          });
          const targetLabel = FACT_LABELS[targetFact] ?? targetFact;
          const foundLabel = FACT_LABELS[fallbackId] ?? fallbackId;
          answerCaveat = `No exact ${targetLabel.toLowerCase()} was found. The document states the ${foundLabel.toLowerCase()} is ${fallbackValue}.`;
          break;
        }
      }
      if (resolvedFacts.length > 0) break;
    }
  }

  if (resolvedFacts.length === 0) return null;

  // ── Compose answer text ────────────────────────────────────────────────
  // Per-field, clean composition.  No unrelated facts folded in.
  const answerParts = resolvedFacts.map(({ factId, value, isStructuredInput }) => {
    const label = FACT_LABELS[factId] ?? factId;
    // For structured input, just the name + version (no "from structured input")
    if (isStructuredInput) return `${value}`;
    return `${label}: ${value}`;
  });
  let answerText = answerParts.join(". ") + (answerParts.length > 1 ? "." : "");
  if (answerCaveat) {
    answerText = answerCaveat;
  }

  const documentFacts = resolvedFacts.filter((f) => !f.isStructuredInput);
  const quoteInputs = documentFacts
    .flatMap(({ supportingSpans }) => supportingSpans
      .slice(0, 1)
      .map((span) => ({
        quote: span.text,
        page: span.page,
        sectionId: span.sectionId,
        heading: span.heading,
      })))
    .slice(0, MAX_QUOTES);

  return {
    answerText,
    route: "project_fact_contract",
    confidence: clampConfidence(Math.min(
      input.queryIntentAnalysis.confidence,
      ...resolvedFacts.map(({ field }) => normalizeConfidence(field.confidence)),
    )),
    evidenceSpanIds: dedupe(documentFacts.flatMap(({ supportingSpans }) => supportingSpans.map((span) => span.spanId))),
    quoteInputs,
    answerQuoteCount: quoteInputs.length,
    pages: dedupe(documentFacts.flatMap(({ supportingSpans }) => supportingSpans.map((span) => span.page).filter((page): page is number => typeof page === "number"))).sort((left, right) => left - right),
    sectionPaths: dedupe(resolvedFacts.map(({ field }) => formatSectionPath(field.sectionPath)).filter(Boolean)),
    warnings: dedupe(resolvedFacts.flatMap(({ field }) => field.warnings)),
    isStructuredInput: documentFacts.length === 0 && resolvedFacts.length > 0,
  };
}

function sectionDisplay(node: SectionNode): string {
  return [node.sectionNumber, node.heading].filter(Boolean).join(" ");
}

function buildSectionCandidate(input: DeterministicRouterInput): RouterCandidate | null {
  if (!input.evidenceDocument || !input.sectionTableIndex || !input.queryIntentAnalysis) return null;
  if (!input.projectFactContract) return null;
  if (input.queryIntentAnalysis.intent !== "section_topic") return null;

  const targetSections = input.queryIntentAnalysis.targetSections;
  if (!targetSections || targetSections.length === 0) return null;

  const index = buildEvidenceSpanIndex({
    evidenceDocument: input.evidenceDocument,
    projectFactContract: input.projectFactContract,
    sectionTableIndex: input.sectionTableIndex,
  });

  const candidates = index.query({
    claimText: input.claimText,
    reviewArea: input.reviewArea,
    methodologyId: "",
    methodologyVersion: "",
    intent: "section_topic",
    targetSections,
    maxCandidates: MAX_QUOTES,
  });

  if (candidates.length === 0) return null;

  // Prefer body-text spans (paragraph, field, formula) for the visible
  // answer over heading-only spans.  Heading text ("STAKEHOLDER COMMENTS")
  // is kept in sectionPaths / quote validation but the answer to the user
  // should show substantive body content.
  //
  // Compose from first 1-3 substantive sentences, stopping before
  // meeting lists, table artifacts, and citation dumps.
  const bodyBlockTypes = new Set(["paragraph", "field", "formula"]);
  const bestBody = candidates.find((c) => bodyBlockTypes.has(c.blockType)) ?? candidates[0];
  const best = candidates[0];
  const node = input.sectionTableIndex.sectionTree.nodesById[targetSections[0]];

  // ── Compose answer from body text ──────────────────────────────────────
  const rawText = bestBody.text;
  const sentences = rawText.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  for (const s of sentences) {
    if (s.length < 8) continue;
    if (s.split(/\s+/).filter(Boolean).length < 3) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) break;
    if (/^(?:List of|Table|Figure|Source:|PROJECT DESCRIPTION)/i.test(s.trim())) break;
    if (s.startsWith("http") || s.startsWith("Available at:")) break;
    kept.push(s);
    if (kept.length >= 3) break;
  }
  const trimmedText = kept.join(" ").replace(/\s+/g, " ").trim() || rawText.slice(0, 300);
  // Reject answers that are just heading echoes or formula markers
  // (e.g. "REDD+ Methodology Framework -- 1 of 1 --").
  const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
  const hasFormulaPattern = trimmedText.includes("-- 1 of") || trimmedText.includes("-- 2 of") || /\d+ of \d+ --/.test(trimmedText);
  if (wordCount < 4 || hasFormulaPattern) return null;

  // For stakeholder consultation: if the main section's body text is a
  // heading prompt or table dump, scan sibling sections (E.2, E.3) for
  // substantive conclusion text.
  const isStakeholder = /\bstakeholder\b/i.test(input.claimText);
  let effectiveText = trimmedText;
  let effectiveQuotes = candidates;
  if (isStakeholder && node) {
    const siblingSpans = input.evidenceDocument.spans.filter((span) => {
      if (span.reliability === "excluded") return false;
      if (!["paragraph", "field", "formula"].includes(span.blockType)) return false;
      if (!span.sectionPath.some((s) => /section:E\.(?:2|3)\b/.test(s))) return false;
      if (!/\bno negative comments\b/i.test(span.text)
        && !/\bsupport the project\b/i.test(span.text)
        && !/\bdue account was taken\b/i.test(span.text)) return false;
      return true;
    });
    if (siblingSpans.length > 0) {
      const siblingText = siblingSpans[0].text.replace(/\s+/g, " ").trim();
      effectiveText = siblingText.length > 10 ? siblingText : trimmedText;
      // Replace quote inputs with sibling span data
      effectiveQuotes = siblingSpans.map((s) => ({
        ...best,
        text: s.text,
        pageNumbers: s.page != null ? [s.page] : [],
        sectionId: s.sectionId ?? targetSections[0],
        heading: s.heading,
        evidenceSpanId: s.spanId,
        sectionPath: s.sectionPath,
      }));
    }
  }
  const answerText = node ? `${sectionDisplay(node)}: ${effectiveText}` : effectiveText;

  return {
    answerText,
    route: "section_index",
    confidence: clampConfidence(Math.min(
      input.queryIntentAnalysis.confidence,
      node?.confidence ?? best.score,
    )),
    evidenceSpanIds: effectiveQuotes.map((c) => c.evidenceSpanId),
    quoteInputs: effectiveQuotes.map((c) => ({
      quote: c.text,
      page: c.pageNumbers[0],
      sectionId: c.sectionId ?? node?.sectionId ?? targetSections[0],
      heading: c.heading ?? node?.heading,
    })),
    answerQuoteCount: 1,
    pages: dedupe(effectiveQuotes.flatMap((c) => c.pageNumbers)),
    sectionPaths: dedupe([
      ...effectiveQuotes.flatMap((c) => c.sectionPath),
      node ? formatSectionPath(node.sectionPath) : "",
    ].filter(Boolean)),
    warnings: [],
    isStructuredInput: false,
  };
}

function hasDeterministicTableProvenance(table: IndexedTable): boolean {
  return !table.limitedProvenance
    && table.pageNumbers.length > 0
    && table.sectionPath.length > 0
    && table.cells.length > 0;
}

function describeTableCells(cells: TableCellReference[]): string {
  return cells
    .slice(0, 2)
    .map((cell) => `r${cell.rowIndex + 1}c${cell.columnIndex + 1}=${cell.text}`)
    .join("; ");
}

function buildTableCandidate(input: DeterministicRouterInput): RouterCandidate | null {
  if (!input.sectionTableIndex || !input.queryIntentAnalysis) return null;
  if (!input.evidenceDocument || !input.projectFactContract) return null;
  if (input.queryIntentAnalysis.intent !== "table_lookup") return null;
  if (input.reviewArea === "baseline" && !input.queryIntentAnalysis.calculationSpecific) {
    return null;
  }

  const targetTables = input.queryIntentAnalysis.targetTables;
  if (!targetTables || targetTables.length === 0) return null;

  // Find table evidence spans via EvidenceSpanIndex
  const index = buildEvidenceSpanIndex({
    evidenceDocument: input.evidenceDocument,
    projectFactContract: input.projectFactContract,
    sectionTableIndex: input.sectionTableIndex,
  });

  const candidates = index.query({
    claimText: input.claimText,
    reviewArea: input.reviewArea,
    methodologyId: "",
    methodologyVersion: "",
    intent: "table_lookup",
    targetTables,
    maxCandidates: MAX_QUOTES,
  });

  // Also look up IndexedTable for cell-level provenance
  const tables = targetTables
    .map((tableKey) => (
      input.sectionTableIndex?.tableIndex.byTableId[tableKey]
      ?? input.sectionTableIndex?.tableIndex.byEvidenceSpanId[tableKey]
    ))
    .filter((table): table is IndexedTable => Boolean(table))
    .filter(hasDeterministicTableProvenance);

  if (tables.length === 0 && candidates.length === 0) return null;

  const selectedTable = tables[0];
  const selectedCells = (input.queryIntentAnalysis.targetCells.length > 0
    ? selectedTable?.cells.filter((cell) => input.queryIntentAnalysis?.targetCells.some((target) => (
      target.rowIndex === cell.rowIndex
      && target.columnIndex === cell.columnIndex
      && target.sourceTableId === cell.sourceTableId
    )))
    : selectedTable?.cells
  )?.slice(0, MAX_QUOTES) ?? [];

  if (selectedCells.length === 0 && candidates.length === 0) return null;

  // When the query asked for specific target cells but none matched,
  // do not fall back to whole-table candidates.
  if (input.queryIntentAnalysis.targetCells.length > 0 && selectedCells.length === 0) return null;

  return {
    answerText: selectedTable
      ? `${selectedTable.heading ?? "Table evidence"}: ${describeTableCells(selectedCells)}`
      : candidates[0]?.text ?? "Table evidence",
    route: "table_index",
    confidence: clampConfidence(Math.min(
      input.queryIntentAnalysis.confidence,
      selectedTable?.confidence ?? candidates[0]?.score ?? 0,
    )),
    evidenceSpanIds: dedupe([
      ...(selectedTable ? [selectedTable.evidenceSpanId] : []),
      ...candidates.map((c) => c.evidenceSpanId),
    ]),
    quoteInputs: selectedCells.length > 0
      ? selectedCells.map((cell) => ({
          quote: cell.text,
          page: cell.pageNumber,
          sectionId: cell.sectionId,
          heading: cell.heading,
        }))
      : candidates.map((c) => ({
          quote: c.text,
          page: c.pageNumbers[0],
          sectionId: c.sectionId,
          heading: c.heading,
        })),
    answerQuoteCount: selectedCells.length || candidates.length,
    pages: selectedTable
      ? selectedTable.pageNumbers
      : dedupe(candidates.flatMap((c) => c.pageNumbers)),
    sectionPaths: selectedTable
      ? [formatSectionPath(selectedTable.sectionPath)]
      : dedupe(candidates.flatMap((c) => c.sectionPath).filter(Boolean)),
    warnings: [],
    isStructuredInput: false,
  };
}

function buildLexicalCandidate(input: DeterministicRouterInput): RouterCandidate | null {
  if (!input.evidenceDocument || !input.sectionTableIndex || !input.projectFactContract) return null;
  if (input.queryIntentAnalysis?.intent === "unsupported_or_out_of_scope") {
    return null;
  }
  if (
    input.queryIntentAnalysis?.intent === "table_lookup"
    || input.queryIntentAnalysis?.intent === "fact_lookup"
    || input.queryIntentAnalysis?.intent === "methodology_lookup"
  ) {
    return null;
  }

  const index = buildEvidenceSpanIndex({
    evidenceDocument: input.evidenceDocument,
    projectFactContract: input.projectFactContract,
    sectionTableIndex: input.sectionTableIndex,
  });

  const candidates = index.query({
    claimText: input.claimText,
    reviewArea: input.reviewArea,
    methodologyId: "",
    methodologyVersion: "",
    maxCandidates: MAX_QUOTES,
  });

  if (candidates.length === 0) return null;

  // Prefer the first candidate with substantive body text
  const bodyBlockTypes = new Set(["paragraph", "field", "formula"]);
  const bestLexical = candidates.find((c) => bodyBlockTypes.has(c.blockType) && c.text.split(/\s+/).filter(Boolean).length >= 4 && !/^[A-Z][\w\s+.-]+ -- \d+ of \d+ --$/.test(c.text)) ?? candidates[0];
  let lexicalText = bestLexical.text;
  // Reject if the best we have is just a heading echo
  if (lexicalText.split(/\s+/).filter(Boolean).length < 3) return null;

  // For baseline/additionality queries: prefer the most informative sentence
  // from the matched text rather than the raw search result.
  const isBaselineQuery = /\bbaseline\b/i.test(input.claimText) && !/\bleakage\b/i.test(input.claimText);
  const isAdditionalityQuery = /\badditionality\b/i.test(input.claimText);
  if (isBaselineQuery || isAdditionalityQuery) {
    // Search ALL candidate texts (not just the first one) for the ideal sentence
    const allText = candidates.map((c) => c.text).join("\n");
    const baselinePreferred = allText.match(
      /(?:^|[\s\n])(.{0,20}BASELINE\s*[ⅠⅡⅢⅣIV1-4][\s\S]{0,300}?(?:prevailing practice|most attractive)[\s\S]{0,200}?[.!?])/i,
    )?.[1];
    const additionalityPreferred = allText.match(
      /(?:^|[\s\n])(.{0,20}(?:concluded that the project is additional|project is additional)[\s\S]{0,200}?[.!?])/i,
    )?.[1];
    const baselineFallback = allText.match(
      /(?:^|[\s\n])(.{0,20}BASELINE\s*[ⅠⅡⅢⅣIV1-4][^.!?\n]{0,250})/i,
    )?.[1];
    if (isBaselineQuery && baselinePreferred) lexicalText = baselinePreferred.trim();
    else if (isBaselineQuery && baselineFallback) lexicalText = baselineFallback.trim();
    else if (isAdditionalityQuery && additionalityPreferred) lexicalText = additionalityPreferred.trim();
    // For baseline: if the only evidence we have is a methodology-step preamble
    // (not the identified baseline scenario), refuse to answer rather than
    // showing a misleading FOUND result.
    if (isBaselineQuery && /the methodology \w+ determines the baseline/i.test(lexicalText)) {
      if (!baselinePreferred && !baselineFallback) return null;
    }
  }

  const lexicalConfidence = clampConfidence(Math.max(bestLexical.score, input.queryIntentAnalysis?.confidence ?? 0));
  if (lexicalConfidence < LEXICAL_MIN_CONFIDENCE) return null;

  return {
    answerText: `The document states: ${lexicalText}`,
    route: "lexical_retrieval",
    confidence: lexicalConfidence,
    evidenceSpanIds: candidates.map((c) => c.evidenceSpanId),
    quoteInputs: candidates.map((c) => ({
      quote: c.text,
      page: c.pageNumbers[0],
      sectionId: c.sectionId,
      heading: c.heading,
    })),
    answerQuoteCount: 1,
    pages: dedupe(candidates.flatMap((c) => c.pageNumbers)),
    sectionPaths: dedupe(candidates.flatMap((c) => c.sectionPath).filter(Boolean)),
    warnings: [],
    isStructuredInput: false,
  };
}

export function buildDeterministicRouterResult(input: DeterministicRouterInput): DeterministicRouterResult {
  if (!input.evidenceDocument || !input.sectionTableIndex || !input.projectFactContract) {
    return buildFallback({
      answerText: "Quick Check could not build the structured evidence context required for deterministic routing.",
      status: "unclear",
      confidence: 0,
      warnings: ["structured_context_unavailable"],
    });
  }

  if (input.queryIntentAnalysis?.intent === "unsupported_or_out_of_scope") {
    return buildFallback({
      answerText: "Quick Check found no document-grounded evidence path for this unsupported question.",
      status: "no_evidence",
      confidence: input.queryIntentAnalysis.confidence,
      warnings: ["unsupported_or_out_of_scope"],
    });
  }

  if (input.queryIntentAnalysis?.intent === "ambiguous") {
    // Ambiguous intents may still have useful section or lexical
    // evidence.  Try those paths before falling back.
    const sectionCandidate = buildSectionCandidate(input);
    if (sectionCandidate) {
      if (sectionCandidate.isStructuredInput) {
        return {
          answerText: sectionCandidate.answerText,
          status: sectionCandidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD ? "answered" : "unclear",
          route: sectionCandidate.route,
          confidence: clampConfidence(sectionCandidate.confidence),
          evidenceSpanIds: sectionCandidate.evidenceSpanIds,
          quotes: [],
          pages: sectionCandidate.pages,
          sectionPaths: sectionCandidate.sectionPaths,
          warnings: sectionCandidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD
            ? [...sectionCandidate.warnings, "structured_input_provenance"]
            : [...sectionCandidate.warnings, "low_confidence", "structured_input_provenance"],
        };
      }
      return finalizeCandidate(input.evidenceDocument, sectionCandidate);
    }
    const lexicalCandidate = buildLexicalCandidate(input);
    if (lexicalCandidate) return finalizeCandidate(input.evidenceDocument, lexicalCandidate);
    return buildFallback({
      answerText: "Quick Check found multiple plausible evidence paths and did not choose one deterministically.",
      status: "unclear",
      confidence: input.queryIntentAnalysis.confidence,
      warnings: ["ambiguous_intent"],
    });
  }

  const candidate = buildFactCandidate(input)
    ?? buildSectionCandidate(input)
    ?? buildTableCandidate(input)
    ?? buildLexicalCandidate(input);

  if (!candidate) {
    const lowConfidence = (input.queryIntentAnalysis?.confidence ?? 0) > 0 && input.queryIntentAnalysis!.confidence < ANSWER_CONFIDENCE_THRESHOLD;
    return buildFallback({
      answerText: lowConfidence
        ? "Quick Check found some routing signal but not enough confidence to answer deterministically."
        : "Quick Check found no validated evidence path for this question.",
      status: lowConfidence ? "unclear" : "no_evidence",
      confidence: input.queryIntentAnalysis?.confidence ?? 0,
      warnings: lowConfidence ? ["low_confidence"] : ["no_validated_route"],
    });
  }

  if (candidate.isStructuredInput) {
    return {
      answerText: candidate.answerText,
      status: candidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD ? "answered" : "unclear",
      route: candidate.route,
      confidence: clampConfidence(candidate.confidence),
      evidenceSpanIds: candidate.evidenceSpanIds,
      quotes: [],
      pages: candidate.pages,
      sectionPaths: candidate.sectionPaths,
      warnings: candidate.confidence >= ANSWER_CONFIDENCE_THRESHOLD
        ? [...candidate.warnings, "structured_input_provenance"]
        : [...candidate.warnings, "low_confidence", "structured_input_provenance"],
    };
  }

  return finalizeCandidate(input.evidenceDocument, candidate);
}
