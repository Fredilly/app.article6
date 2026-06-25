"use server";

import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import type { StructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
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
    const llmExtractor = await import(
      "@/lib/quickCheck/llmFactExtractor"
    );
    const { tryLlmFallback } = await import(
      "@/lib/quickCheck/projectFacts/llmCandidateBridge"
    );
    if (llmExtractor.isLlmFactExtractorEnabled()) {
      // Host country: try LLM only when deterministic truly found nothing
      // (no candidates at all — empty evidenceSpanIds). If deterministic
      // found conflicting but rejected evidence, preserve the uncertainty.
      if (!projectFactContract.hostCountry.value && projectFactContract.hostCountry.evidenceSpanIds.length === 0) {
        const hostCandidates = await tryLlmFallback(evidenceDocument, "hostCountry", []);
        if (hostCandidates.length > 0) {
          const best = hostCandidates[0]!;
          projectFactContract.hostCountry = {
            value: best.value,
            confidence: best.confidence,
            evidenceSpanIds: [best.span.spanId],
            pageNumbers: best.span.page != null ? [best.span.page] : [],
            sectionPath: best.span.sectionPath ?? [],
            heading: best.span.heading,
            extractionRule: "llm:ollama",
            warnings: [],
          };
          // Mirror hostCountry into projectCountry to keep them consistent
          projectFactContract.projectCountry = {
            ...projectFactContract.hostCountry,
            extractionRule: "llm:ollama:mirror-project-country",
          };
        }
      }
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
