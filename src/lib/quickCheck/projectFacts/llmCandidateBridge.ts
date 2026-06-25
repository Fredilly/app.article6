/**
 * Wire the LLM fact extractor into the deterministic ProjectFactContract pipeline.
 *
 * When the feature flag is enabled and deterministic extraction found no
 * candidates for a field, feeds relevant spans to the LLM and converts
 * validated candidates into the same Candidate format used by the
 * deterministic path.
 */
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { Candidate } from "@/lib/quickCheck/projectFacts/buildProjectFactContract";
import { extractFieldCandidates, isLlmFactExtractorEnabled, type InputSpan } from "@/lib/quickCheck/llmFactExtractor";

/**
 * Try LLM-assisted extraction when deterministic path found no candidates.
 *
 * @param document - The evidence document with spans
 * @param field - Field to extract (e.g. "hostCountry", "methodologyPrimary")
 * @param existingCandidates - Candidates already found by deterministic search
 * @returns Augmented candidate list with LLM proposals (if any)
 */
export async function tryLlmFallback(
  document: EvidenceDocument,
  field: string,
  existingCandidates: Candidate[],
): Promise<Candidate[]> {
  // Skip if flag is off or deterministic already found candidates
  if (!isLlmFactExtractorEnabled()) return existingCandidates;
  if (existingCandidates.length > 0) return existingCandidates;

  // Build input spans from all document spans (limit to 20 in extractor)
  const spans: InputSpan[] = document.spans
    .filter((s) => s.reliability !== "excluded")
    .filter((s) => ["paragraph", "field", "title", "formula"].includes(s.blockType))
    .filter((s) => !s.layout?.repeatedHeaderFooter)
    .filter((s) => !["toc", "header", "footer", "annex"].includes(s.blockType))
    .map((s) => ({ id: s.spanId, text: s.text, page: s.page }));

  if (spans.length === 0) return existingCandidates;

  const llmCandidates = await extractFieldCandidates(field, spans);

  if (llmCandidates.length === 0) return existingCandidates;

  // Convert LLM candidates to the same Candidate format as deterministic path
  const augmented: Candidate[] = [...existingCandidates];

  for (const llm of llmCandidates) {
    const span = document.spans.find((s) => s.spanId === llm.evidenceSpanId);
    if (!span) continue;

    augmented.push({
      value: llm.value,
      normalizedValue: llm.value.trim().toLowerCase().replace(/\s+/g, " "),
      confidence: llm.confidence,
      span,
      extractionRule: "llm:ollama",
      warnings: [],
    });
  }

  return augmented;
}
