"use server";

import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { StructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import { resolvePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { parseDocumentText } from "@/lib/documentParsing";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";

initPymupdfAdapterRuntime();

export { type StructuredQueryContext };

export async function resolveStructuredQueryContext(rawPddText: string, pdfRef?: string): Promise<StructuredQueryContext> {
  const pdfFilePath = pdfRef ? resolvePdfRef(pdfRef) : undefined;

  // When we have a real PDF path, parse with it to get PyMuPDF structure.
  // Otherwise, fall through to rawText-only parsing.
  if (pdfFilePath) {
    const parsed = parseDocumentText({ rawText: rawPddText, pdfFilePath });
    const { buildArticle6DocumentModel } = await import("@/lib/documentModel");
    const { compileEvidenceDocumentFromStructure } = await import(
      "@/lib/quickCheck/evidence/compileEvidenceDocument"
    );
    const { buildProjectFactContract } = await import(
      "@/lib/quickCheck/projectFacts/buildProjectFactContract"
    );
    const { buildSectionTableIndex } = await import(
      "@/lib/quickCheck/indexing/buildSectionTableIndex"
    );
    const documentStructure = buildArticle6DocumentModel({ parsedDocument: parsed });
    const evidenceDocument = compileEvidenceDocumentFromStructure({
      docId: "quick-check-review-question",
      documentStructure,
    });
    const projectFactContract = buildProjectFactContract(evidenceDocument);

    // LLM-assisted field extraction (feature-flagged, default off)
    // When deterministic extraction finds no candidates for a field, tries
    // Ollama to propose candidates. Only accepts candidates whose quotes
    // are verified against source spans with provenanced evidenceSpanIds.
    //
    // The router/validator remains the sole authority for visible answer status.
    // LLM candidates only fill ProjectFactContract fields when deterministic
    // evidence is empty — they never override conflicted evidence.
    const llmExtractor = await import(
      "@/lib/quickCheck/llmFactExtractor"
    );
    const { tryLlmFallback } = await import(
      "@/lib/quickCheck/projectFacts/llmCandidateBridge"
    );
    if (llmExtractor.isLlmFactExtractorEnabled()) {
      // LLM fallback for fields where deterministic found nothing.
      // Tries Ollama for each field, only accepts candidates with
      // verified quotes from real spans. Does NOT override conflicted
      // deterministic evidence — only fills in total gaps.

      const llmFieldFallback = async (
        field: string,
        pfcField: ProjectFactField<string | null>,
      ): Promise<void> => {
        if (pfcField.value || pfcField.evidenceSpanIds.length > 0) return;
        const candidates = await tryLlmFallback(evidenceDocument, field, []);
        if (candidates.length === 0) return;
        const best = candidates[0]!;
        pfcField.value = best.value;
        pfcField.confidence = best.confidence;
        pfcField.evidenceSpanIds = [best.span.spanId];
        pfcField.pageNumbers = best.span.page != null ? [best.span.page] : [];
        pfcField.sectionPath = best.span.sectionPath ?? [];
        pfcField.heading = best.span.heading;
        pfcField.extractionRule = "llm:ollama";
        pfcField.warnings = [];
      };

      await llmFieldFallback("hostCountry", projectFactContract.hostCountry);
      // Mirror hostCountry into projectCountry
      if (projectFactContract.hostCountry.value && !projectFactContract.projectCountry.value) {
        projectFactContract.projectCountry = {
          ...projectFactContract.hostCountry,
          extractionRule: "llm:ollama:mirror-project-country",
        };
      }
      await llmFieldFallback("methodologyPrimary", projectFactContract.methodologyPrimary);
      await llmFieldFallback("projectTitle", projectFactContract.projectTitle);
      await llmFieldFallback("creditingPeriod", projectFactContract.creditingPeriod);
    }

    const sectionTableIndex = buildSectionTableIndex({
      documentStructure,
      evidenceDocument,
    });
    return {
      parsedDocument: parsed,
      documentStructure,
      evidenceDocument,
      projectFactContract,
      sectionTableIndex,
      parserAdapterId: parsed.adapterId,
      parserFallbackFrom: parsed.diagnostics?.metadata?.fallback_from,
    };
  }

  // Default path: raw text only
  return getStructuredQueryContext(rawPddText);
}
