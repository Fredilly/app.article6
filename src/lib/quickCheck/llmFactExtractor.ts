/**
 * LLM Fact Extractor — proposes candidate field values from evidence spans.
 *
 * Feature-flagged behind QUICK_CHECK_LLM_FACT_EXTRACTOR=ollama.
 * Default off. The LLM only proposes candidates — the deterministic
 * ProjectFactContract build process decides whether to use them.
 *
 * Architecture (per approved plan):
 *   PyMuPDF → EvidenceDocument (spans with page numbers)
 *     → candidate spans selected for each field
 *     → Ollama proposes { field, value, quote, page, confidence }
 *     → validator: does the quote actually exist in the referenced span?
 *     → if yes: return as candidate for ProjectFactContract
 *     → if no: discard, fall back to deterministic
 *     → router remains final authority
 */

const OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";
const LLM_TIMEOUT_MS = 30_000;
const FEATURE_FLAG = "QUICK_CHECK_LLM_FACT_EXTRACTOR";

export type LlmFactCandidate = {
  field: string;
  value: string;
  quote: string;
  page: number | null;
  evidenceSpanId: string | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type LlmExtractionResult = {
  candidates: LlmFactCandidate[];
  llmAvailable: boolean;
  error: string | null;
};

type OllamaResponse = {
  response?: string;
  error?: string;
};

/** Supported fields the LLM can propose candidates for. */
const SUPPORTED_FIELDS = [
  "hostCountry",
  "projectTitle",
  "methodologyPrimary",
] as const;

const JSON_SCHEMA = `{
  "fields": [
    {
      "field": "hostCountry" | "projectTitle" | "methodologyPrimary",
      "value": "extracted value as string",
      "quote": "exact verbatim text from the document that supports this value",
      "page": number or null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

/**
 * Check whether the Ollama fact extractor feature flag is enabled.
 */
export function isLlmFactExtractorEnabled(): boolean {
  return process.env[FEATURE_FLAG] === "ollama";
}

/**
 * Build a prompt for the LLM from candidate evidence spans.
 * Only feeds relevant spans (not the full PDD text) to keep context small.
 */
function buildPrompt(field: string, spanTexts: string[]): string {
  const snippetCount = spanTexts.length;
  const snippetPreview = spanTexts
    .map((text, i) => `[span ${i + 1}]: ${text}`)
    .join("\n");

  return `You are a carbon project document analyst. Extract the "${field}" field from the following document spans.

Rules:
- Return ONLY valid JSON matching the schema below.
- The "quote" field MUST be a verbatim substring from one of the provided spans.
- If the field cannot be determined from the spans, set value to null.
- Do not guess. Do not invent text.

JSON schema:
${JSON_SCHEMA}

Document spans (${snippetCount} total):
${snippetPreview}

Return only JSON:`;
}

/**
 * Call Ollama with a prompt and parse the JSON response.
 * Returns null on any failure (timeout, parse error, model error).
 */
async function callOllama(prompt: string): Promise<OllamaResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `Ollama HTTP ${response.status}: ${response.statusText}` };
    }

    const data = (await response.json()) as OllamaResponse;
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: `Ollama timed out after ${LLM_TIMEOUT_MS}ms` };
    }
    return { error: `Ollama request failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse the LLM JSON response and validate each candidate.
 * A candidate is valid only if its quote exists verbatim in the provided spans.
 */
function parseAndValidateCandidates(
  rawResponse: string,
  spanTexts: string[],
): LlmFactCandidate[] {
  let parsed: { fields?: Array<Record<string, unknown>> };

  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.fields)) return [];

  const candidates: LlmFactCandidate[] = [];

  for (const entry of parsed.fields) {
    const field = String(entry.field ?? "");
    const value = String(entry.value ?? "");
    const quote = String(entry.quote ?? "");
    const confidence = String(entry.confidence ?? "low");

    if (!field || !value || !quote) continue;

    if (!SUPPORTED_FIELDS.includes(field as typeof SUPPORTED_FIELDS[number])) continue;

    // Validate: the quote must exist verbatim in at least one span
    const quoteExists = spanTexts.some((text) => text.includes(quote));
    if (!quoteExists) continue;

    const page = typeof entry.page === "number" ? entry.page : null;

    candidates.push({
      field,
      value,
      quote,
      page,
      evidenceSpanId: null, // caller must resolve span ID
      confidence: ["high", "medium", "low"].includes(confidence)
        ? (confidence as "high" | "medium" | "low")
        : "low",
      warnings: quoteExists ? [] : ["Quote does not match any source span — discarded"],
    });
  }

  return candidates;
}

/**
 * Extract field candidates using Ollama.
 *
 * @param field - The field to extract (e.g. "hostCountry")
 * @param spanTexts - Array of evidence span texts from the document
 * @returns Array of validated candidate proposals (may be empty)
 */
export async function extractFieldCandidates(
  field: string,
  spanTexts: string[],
): Promise<LlmFactCandidate[]> {
  if (!isLlmFactExtractorEnabled()) return [];

  if (!SUPPORTED_FIELDS.includes(field as typeof SUPPORTED_FIELDS[number])) return [];

  if (spanTexts.length === 0) return [];

  // Limit spans to keep context small (per GPT's feedback: don't feed full PDD)
  const limitedSpans = spanTexts.slice(0, 20);

  const prompt = buildPrompt(field, limitedSpans);
  const response = await callOllama(prompt);

  if (!response || response.error || !response.response) {
    return [];
  }

  return parseAndValidateCandidates(response.response, limitedSpans);
}
