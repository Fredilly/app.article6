/**
 * Client-side bridge to the LLM fact extraction API.
 *
 * After Quick Check completes deterministic extraction, call
 * this for each check that returned "missing" or "unclear".
 * Returns validated candidates with span provenance, or empty
 * array if LLM is unavailable or couldn't find the answer.
 *
 * LLM results are NEVER used to mutate EvidenceCheckResult.status.
 * The router/validator remains the sole authority for visible status.
 * See: https://github.com/Fredilly/app.article6/pull/825
 */
import type { InputSpan, LlmFactCandidate } from "@/lib/quickCheck/llmFactExtractor";
import type { EvidenceCheckStatus } from "@/lib/quickCheck/evidenceChecks";

const LLM_API_PATH = "/api/quick-check/llm-extract";

/**
 * Map check IDs to LLM field names and the question context to send.
 */
const CHECK_TO_FIELD: Record<string, { field: string; question: string }> = {
  host_country: { field: "hostCountry", question: "What is the host country?" },
  methodology: { field: "methodologyPrimary", question: "What methodology was applied?" },
  baseline_scenario: { field: "baselineScenario", question: "What is the baseline scenario?" },
  additionality: { field: "additionality", question: "How is additionality demonstrated?" },
  leakage: { field: "leakage", question: "How is leakage accounted for?" },
  stakeholder_consultation: { field: "stakeholderConsultation", question: "What stakeholder consultation was conducted?" },
  monitoring_plan: { field: "monitoringPlan", question: "What is the monitoring plan?" },
  project_boundary: { field: "projectBoundary", question: "What is the project boundary?" },
  crediting_period: { field: "creditingPeriod", question: "What is the crediting period?" },
  emission_reduction_calculation: { field: "emissionReductionCalculation", question: "How are emission reductions calculated?" },
  applicability_conditions: { field: "applicabilityConditions", question: "What are the applicability conditions?" },
};

type LlmSuggestionEligibilityInput = {
  status: EvidenceCheckStatus;
  answerText: string;
  rawAnswerText?: string;
};

/**
 * Check whether the client-side LLM feature flag is enabled.
 * Uses NEXT_PUBLIC_ so it's available in the browser at build time.
 */
export function isLlmUiEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_QUICK_CHECK_LLM === "1";
}

function normalizedAnswerLength(value: string): number {
  return value.replace(/\s+/g, " ").trim().length;
}

export function shouldFetchLlmSuggestion(input: LlmSuggestionEligibilityInput): boolean {
  if (input.status === "missing" || input.status === "unclear") return true;
  if (input.status !== "found") return false;
  const rawAnswer = input.rawAnswerText ?? input.answerText;
  return normalizedAnswerLength(rawAnswer) < 3;
}

/**
 * Extract candidate spans from the evidence document for LLM analysis.
 * Returns content spans relevant to the given field.
 * For hostCountry, prefers spans mentioning country/location keywords.
 */
export function extractSpansForLlm(
  spans: Array<{ spanId: string; text: string; page: number | null; blockType: string }>,
  field?: string,
  maxSpans = 100,
): InputSpan[] {
  const valid = spans
    .filter((s) => s.text.trim().length > 0)
    .filter((s) => !["toc", "header", "footer", "annex", "excluded"].includes(s.blockType));

  if (field === "hostCountry") {
    const countryKeywords = [
      "country", "location", "papua", "new guinea", "peru", "ghana",
      "indonesia", "brazil", "colombia", "nigeria", "kenya", "congo",
      "tanzania", "myanmar", "laos", "cambodia", "vietnam", "chile",
      "ecuador", "bolivia", "project area",
    ];
    const keywordSpans = valid.filter((s) =>
      countryKeywords.some((kw) => s.text.toLowerCase().includes(kw)),
    );
    const otherSpans = valid.filter((s) =>
      !countryKeywords.some((kw) => s.text.toLowerCase().includes(kw)),
    );
    // Prioritize keyword spans, fill rest with other spans up to maxSpans
    const prioritized = [...keywordSpans, ...otherSpans]
      .slice(0, maxSpans)
      .map((s) => ({ id: s.spanId, text: s.text, page: s.page }));
    return prioritized;
  }

  return valid
    .slice(0, maxSpans)
    .map((s) => ({ id: s.spanId, text: s.text, page: s.page }));
}

/**
 * Call the LLM extraction API for a single check.
 *
 * @param checkId - The Quick Check check ID (e.g. "host_country")
 * @param documentSpans - All evidence spans from the extracted document
 * @returns Array of validated candidates (empty if none found or unavailable)
 *
 * LLM candidates do NOT mutate EvidenceCheckResult.status.
 * They are suggestions only — the router controls final answer visibility.
 */
export async function fetchLlmCandidate(
  checkId: string,
  documentSpans: Array<{ spanId: string; text: string; page: number | null; blockType: string }>,
): Promise<LlmFactCandidate[]> {
  if (!isLlmUiEnabled()) return [];

  const mapping = CHECK_TO_FIELD[checkId];
  if (!mapping) return [];

  const spans = extractSpansForLlm(documentSpans, mapping.field);
  if (spans.length === 0) return [];

  try {
    const response = await fetch(LLM_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: mapping.field,
        question: mapping.question,
        spans,
      }),
      signal: AbortSignal.timeout(65_000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      candidates?: LlmFactCandidate[];
    };

    return data.candidates ?? [];
  } catch {
    return [];
  }
}

export { CHECK_TO_FIELD };
