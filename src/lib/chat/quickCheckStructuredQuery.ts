"use server";

import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { StructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import { resolvePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { parseDocumentText, type ParsedDocument } from "@/lib/documentParsing";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";

initPymupdfAdapterRuntime();

export { type StructuredQueryContext };

export async function resolveStructuredQueryContext(rawPddText: string, pdfRef?: string, parsedDocument?: ParsedDocument): Promise<StructuredQueryContext> {
  const pdfFilePath = parsedDocument ? undefined : pdfRef ? await resolvePdfRef(pdfRef) : undefined;

  // When we have a real PDF path, parse with it to get PyMuPDF structure.
  // Otherwise, fall through to rawText-only parsing.
  if (parsedDocument || pdfFilePath) {
    const parsed = parsedDocument ?? parseDocumentText({ rawText: rawPddText, pdfFilePath });
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
    // When deterministic extraction finds zero or very short answers
    // (< 3 chars), tries OpenRouter to propose better candidates.
    // Only accepts candidates whose quotes are verified against source
    // spans with provenanced evidenceSpanIds.
    //
    // The router/validator remains the sole authority for visible answer status.
    // LLM candidates only fill ProjectFactContract fields when deterministic
    // evidence is empty or too short — they never override good evidence.
    const llmExtractor = await import(
      "@/lib/quickCheck/llmFactExtractor"
    );
    const { tryLlmFallback } = await import(
      "@/lib/quickCheck/projectFacts/llmCandidateBridge"
    );
    if (llmExtractor.isLlmFactExtractorEnabled()) {
      // LLM fallback for fields where deterministic found nothing or
      // only short answers (< 3 chars). Tries OpenRouter for each field,
      // only accepts candidates with verified quotes from real spans.
      // Does NOT override good deterministic evidence.

      const llmFieldFallback = async (
        field: string,
        pfcField: ProjectFactField<string | null>,
      ): Promise<void> => {
        // Skip if deterministic found a good answer (>= 3 chars with evidence)
        const valStr = String(pfcField.value ?? "").trim();
        if (valStr.length >= 3 && pfcField.evidenceSpanIds.length > 0) return;
        const candidates = await tryLlmFallback(evidenceDocument, field, []);
        if (candidates.length === 0) return;
        const best = candidates[0]!;
        pfcField.value = best.value;
        pfcField.confidence = best.confidence;
        pfcField.evidenceSpanIds = [best.span.spanId];
        pfcField.pageNumbers = best.span.page != null ? [best.span.page] : [];
        pfcField.sectionPath = best.span.sectionPath ?? [];
        pfcField.heading = best.span.heading;
        pfcField.extractionRule = "llm:openrouter";
        pfcField.warnings = [];
      };

      await llmFieldFallback("hostCountry", projectFactContract.hostCountry);
      // Mirror hostCountry into projectCountry
      if (projectFactContract.hostCountry.value && !projectFactContract.projectCountry.value) {
        projectFactContract.projectCountry = {
          ...projectFactContract.hostCountry,
          extractionRule: "llm:openrouter:mirror-project-country",
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
