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
