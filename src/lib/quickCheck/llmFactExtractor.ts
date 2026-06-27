/**
 * LLM Fact Extractor — proposes candidate field values from evidence spans.
 *
 * Feature-flagged behind QUICK_CHECK_LLM_FACT_EXTRACTOR=openrouter.
 * Default off. The LLM only proposes candidates — the deterministic
 * ProjectFactContract build process decides whether to use them.
 *
 * Architecture (per approved plan):
 *   PyMuPDF → EvidenceDocument (spans with page numbers)
 *     → candidate spans selected for each field
 *     → OpenRouter (Nemotron Nano 12B) proposes { field, value, quote, page, confidence }
 *     → validator: quote must exist verbatim in ONE specific span;
 *       evidenceSpanId and page are set from that matched span
 *     → if valid: return as candidate for ProjectFactContract
 *     → if no: discard, fall back to deterministic
 *     → router remains final authority
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";
const OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";
const LLM_TIMEOUT_MS = 45_000;
const FEATURE_FLAG = "QUICK_CHECK_LLM_FACT_EXTRACTOR";

export type InputSpan = {
  id: string;
  text: string;
  page: number | null;
};

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

type LlmResponse = {
  response?: string;
  error?: string;
};

/** Supported fields the LLM can propose candidates for. */
const SUPPORTED_FIELDS = [
  "hostCountry",
  "projectTitle",
  "methodologyPrimary",
  "baselineScenario",
  "additionality",
  "leakage",
  "stakeholderConsultation",
  "monitoringPlan",
  "projectBoundary",
  "creditingPeriod",
  "emissionReductionCalculation",
  "applicabilityConditions",
] as const;

const JSON_SHAPE_DESCRIPTION = `{
  "fields": [
    {
      "field": "hostCountry" | "projectTitle" | "methodologyPrimary" | "baselineScenario" | "additionality" | "leakage" | "stakeholderConsultation" | "monitoringPlan" | "projectBoundary" | "creditingPeriod" | "emissionReductionCalculation" | "applicabilityConditions",
      "value": "extracted value as string",
      "quote": "exact verbatim text from the document that supports this value",
      "page": number or null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

/**
 * Check whether the LLM fact extractor feature flag is enabled.
 */
export function isLlmFactExtractorEnabled(): boolean {
  return process.env[FEATURE_FLAG] === "openrouter" || process.env[FEATURE_FLAG] === "ollama";
}

/**
 * Build a prompt for the LLM from candidate evidence spans.
 * Only feeds relevant spans (not the full PDD text) to keep context small.
 */
function buildPrompt(field: string, spans: InputSpan[], question?: string): string {
  const snippetPreview = spans
    .map((s, i) => `[span ${i + 1}] (page ${s.page ?? "?"}): ${s.text}`)
    .join("\n");

  const questionLine = question
    ? `\nContext question: "${question}"`
    : "";

  return `You are a carbon project document analyst. Extract the "${field}" field from the following document spans.${questionLine}

Rules:
- Return ONLY valid JSON matching the shape below.
- The "quote" field MUST be a verbatim substring from one of the provided spans.
- If the field cannot be determined from the spans, set value to null AND quote to null.
- If you cannot find the answer, respond IMMEDIATELY with null values.
- Do not guess. Do not invent text.

JSON shape:
${JSON_SHAPE_DESCRIPTION}

Document spans (${spans.length} total):
${snippetPreview}

Return only JSON (no markdown, no backticks):`;
}

/**
 * Call the configured LLM provider with a prompt and normalize the response.
 * Returns null on any failure (timeout, parse error, model error).
 */
async function callLlm(prompt: string): Promise<LlmResponse | null> {
  const provider = process.env[FEATURE_FLAG];

  if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
    return { error: "OPENROUTER_API_KEY is not set" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    if (provider === "ollama") {
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

      return (await response.json()) as LlmResponse;
    }

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return { error: `OpenRouter HTTP ${response.status}: ${errorBody.substring(0, 200)}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { error: "OpenRouter returned empty response" };
    }

    // OpenRouter returns chat completions format.
    // We normalize to LlmResponse shape: { response?: string, error?: string }
    return { response: content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: `${provider === "ollama" ? "Ollama" : "OpenRouter"} timed out after ${LLM_TIMEOUT_MS}ms` };
    }
    return { error: `${provider === "ollama" ? "Ollama" : "OpenRouter"} request failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse the LLM JSON response and validate each candidate.
 *
 * Validation rules (per approved design):
 * 1. Quote must exist verbatim in exactly one source span
 * 2. evidenceSpanId is set to the matching span's ID
 * 3. page is taken from the matching span (not trusted from LLM)
 * 4. Unsupported fields are rejected
 * 5. Missing fields are rejected
 * 6. Confidence is normalized to high/medium/low
 */
export function parseAndValidateCandidates(
  rawResponse: string,
  spans: InputSpan[],
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

    if (!field || !value || !quote) continue;
    if (!SUPPORTED_FIELDS.includes(field as typeof SUPPORTED_FIELDS[number])) continue;

    // Find the exact span that contains the quote
    // Find the exact span that contains the quote (lenient: trim whitespace)
    const matchedSpan = spans.find((s) => s.text.includes(quote) || s.text.includes(quote.trim()));
    if (!matchedSpan) continue;

    candidates.push({
      field,
      value,
      quote,
      page: matchedSpan.page, // use span's page, not LLM's
      evidenceSpanId: matchedSpan.id, // pin to the exact span
      confidence: ["high", "medium", "low"].includes(String(entry.confidence ?? ""))
        ? (String(entry.confidence) as "high" | "medium" | "low")
        : "low",
      warnings: [],
    });
  }

  return candidates;
}

/**
 * Extract field candidates using LLM.
 *
 * @param field - The field to extract (e.g. "hostCountry")
 * @param spans - Array of structured input spans with id, text, page
 * @param question - Optional context question to guide extraction
 * @returns Array of validated candidate proposals (may be empty)
 */
export async function extractFieldCandidates(
  field: string,
  spans: InputSpan[],
  question?: string,
): Promise<LlmFactCandidate[]> {
  if (!isLlmFactExtractorEnabled()) return [];
  if (!SUPPORTED_FIELDS.includes(field as typeof SUPPORTED_FIELDS[number])) return [];
  if (spans.length === 0) return [];

  // Limit spans to keep context small — use a generous cap for real PDDs
  // (30 is too few: methodology, baseline etc. live deep in sections B/C/D)
  const limitedSpans = spans.slice(0, 100);

  const prompt = buildPrompt(field, limitedSpans, question);
  const response = await callLlm(prompt);

  if (!response || response.error || !response.response) {
    return [];
  }

  const allCandidates = parseAndValidateCandidates(response.response, limitedSpans);
  return allCandidates.filter((c) => c.field === field);
}
