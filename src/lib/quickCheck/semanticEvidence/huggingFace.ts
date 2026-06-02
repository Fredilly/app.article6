import { z } from "zod";
import { buildArticle6DocumentModel } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import type { SemanticEvidenceCandidate, SemanticEvidenceStatus } from "@/lib/quickCheck/retrieval/types";

const HUGGING_FACE_URL = "https://api-inference.huggingface.co/models/openbmb/MiniCPM5-1B";
const MAX_BLOCKS = 40;
const MAX_BLOCK_CHARS = 1400;

const responseSchema = z.array(z.object({
  block_id: z.string().min(1),
  page: z.number().int().positive().nullable().optional(),
  exact_quote: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
}));

type SuggestInput = {
  claimText: string;
  rawPddText: string;
  methodologyId?: string;
  methodologyVersion?: string;
};

type SuggestResult = {
  status: SemanticEvidenceStatus;
  candidates: SemanticEvidenceCandidate[];
  warning?: string;
};

function trimText(value: string, maxChars = MAX_BLOCK_CHARS): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).replace(/\s+\S*$/, "")} […]`;
}

function extractKeywords(claimText: string): string[] {
  return [...new Set(
    claimText.toLowerCase().replace(/[^\w\s.-]/g, " ").split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4),
  )];
}

function buildCandidateBlocks(input: SuggestInput) {
  const parsedDocument = parseDocumentText({ rawText: input.rawPddText });
  const model = buildArticle6DocumentModel({ parsedDocument });
  const sectionById = new Map(model.sections.map((section) => [section.id, section]));
  const keywords = extractKeywords(input.claimText);

  return model.blocks
    .filter((block) => block.cleanText.trim().length > 0)
    .map((block) => {
      const section = block.sectionId ? sectionById.get(block.sectionId) : undefined;
      const heading = section?.titleClean ?? null;
      const haystack = `${heading ?? ""} ${block.matchingText}`;
      const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
      return {
        blockId: block.id,
        page: block.pageNumber ?? null,
        heading,
        text: trimText(block.cleanText),
        score,
      };
    })
    .sort((left, right) => right.score - left.score || right.text.length - left.text.length)
    .slice(0, MAX_BLOCKS);
}

function buildPrompt(input: SuggestInput, blocks: ReturnType<typeof buildCandidateBlocks>): string {
  return [
    "Return JSON only.",
    "Return an array of objects with keys: block_id, page, exact_quote, reason, confidence.",
    "Rules:",
    "- exact_quote must be copied exactly from the candidate block text.",
    "- use only the blocks provided below.",
    "- return [] if there is no relevant evidence.",
    "",
    `Question: ${input.claimText}`,
    `Methodology: ${input.methodologyId || "unknown"} ${input.methodologyVersion || ""}`.trim(),
    JSON.stringify(blocks.map((block) => ({
      block_id: block.blockId,
      page: block.page,
      heading: block.heading,
      text: block.text,
    }))),
  ].join("\n");
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function generatedTextFromPayload(payload: unknown): string {
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (first && typeof first === "object" && "generated_text" in first && typeof first.generated_text === "string") {
      return first.generated_text;
    }
  }
  if (payload && typeof payload === "object" && "generated_text" in payload && typeof payload.generated_text === "string") {
    return payload.generated_text;
  }
  throw new Error("Semantic evidence model did not return generated text.");
}

export async function suggestSemanticEvidence(input: SuggestInput): Promise<SuggestResult> {
  if (!process.env.HF_API_KEY) {
    return {
      status: "disabled",
      candidates: [],
      warning: "HF_API_KEY is not configured; semantic evidence suggestions are disabled.",
    };
  }

  const blocks = buildCandidateBlocks(input);
  if (blocks.length === 0) {
    return { status: "invalid_response", candidates: [], warning: "No candidate blocks were available." };
  }

  try {
    const response = await fetch(HUGGING_FACE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.HF_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: buildPrompt(input, blocks),
        parameters: {
          max_new_tokens: 700,
          return_full_text: false,
          temperature: 0.1,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Semantic evidence request failed with ${response.status}`);
    }
    const payload = await response.json();
    const generatedText = generatedTextFromPayload(payload);
    const jsonArray = extractJsonArray(generatedText);
    if (!jsonArray) {
      return { status: "invalid_response", candidates: [], warning: "Semantic evidence response was not valid JSON." };
    }
    const parsed = responseSchema.safeParse(JSON.parse(jsonArray));
    if (!parsed.success) {
      return { status: "invalid_response", candidates: [], warning: "Semantic evidence response shape was invalid." };
    }
    const blockMap = new Map(blocks.map((block) => [block.blockId, block]));
    const candidates = parsed.data.flatMap((item) => {
      const block = blockMap.get(item.block_id);
      if (!block) return [];
      if (block.page !== (item.page ?? null)) return [];
      if (!block.text.includes(item.exact_quote)) return [];
      return [{
        blockId: item.block_id,
        page: item.page ?? null,
        quote: item.exact_quote,
        reason: item.reason,
        confidence: item.confidence,
        heading: block.heading,
      } satisfies SemanticEvidenceCandidate];
    });
    return {
      status: "available",
      candidates,
      warning: candidates.length === 0 ? "Semantic evidence suggestions were returned, but none passed deterministic validation." : undefined,
    };
  } catch (error) {
    return {
      status: "request_failed",
      candidates: [],
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
