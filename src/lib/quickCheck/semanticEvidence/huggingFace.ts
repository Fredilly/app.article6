import { z } from "zod";
import { buildArticle6DocumentModel } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import type { Article6DocumentBlock, Article6DocumentModel } from "@/lib/documentModel/types";
import type { SemanticEvidenceCandidate, SemanticEvidenceStatus } from "@/lib/quickCheck/retrieval/types";

const HUGGING_FACE_URL = "https://api-inference.huggingface.co/models/openbmb/MiniCPM5-1B";
const MAX_BLOCKS = 40;
const MAX_BLOCK_CHARS = 1400;
const MAX_RETURNED_CANDIDATES = 8;

const llmCandidateSchema = z.object({
  block_id: z.string().min(1),
  page: z.number().int().nonnegative().nullable().optional(),
  exact_quote: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const llmResponseSchema = z.array(llmCandidateSchema);

export type SemanticEvidenceBlock = {
  blockId: string;
  page: number | null;
  heading: string | null;
  text: string;
  score: number;
};

export type SemanticEvidenceSuggestionResult = {
  status: SemanticEvidenceStatus;
  candidates: SemanticEvidenceCandidate[];
  warning?: string;
  requestBlockCount: number;
  parserAdapterId?: string;
};

type SemanticEvidenceInput = {
  claimText: string;
  rawPddText?: string;
  methodologyId?: string;
  methodologyVersion?: string;
};

type FetchLike = typeof fetch;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function trimBlockText(value: string, maxChars = MAX_BLOCK_CHARS): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).replace(/\s+\S*$/, "")} […]`;
}

function extractKeywords(claimText: string): string[] {
  const normalized = normalizeText(claimText);
  return [...new Set(
    normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .filter((token) => !new Set([
        "does", "this", "that", "with", "from", "what", "when", "where", "which",
        "have", "been", "being", "will", "would", "could", "should", "shall",
        "document", "project", "section", "describe", "explain", "assess", "review",
        "question", "evidence", "check", "include", "support", "provide",
      ]).has(token)),
  )];
}

function buildBlockHeadingMap(model: Article6DocumentModel): Map<string, string> {
  const byId = new Map(model.sections.map((section) => [section.id, section.titleClean]));
  return byId;
}

function scoreBlock(block: Article6DocumentBlock, claimKeywords: string[], heading: string | null): number {
  const haystack = normalizeText(`${heading ?? ""} ${block.cleanText}`);
  let score = 0;
  for (const keyword of claimKeywords) {
    if (haystack.includes(keyword)) score += heading && normalizeText(heading).includes(keyword) ? 3 : 1;
  }
  if (block.type === "paragraph") score += 0.5;
  if (heading) score += 0.25;
  return score;
}

export function selectSemanticEvidenceBlocks(
  model: Article6DocumentModel,
  claimText: string,
  maxBlocks = MAX_BLOCKS,
): SemanticEvidenceBlock[] {
  const claimKeywords = extractKeywords(claimText);
  const headingsBySectionId = buildBlockHeadingMap(model);

  return model.blocks
    .filter((block) => block.cleanText.trim().length > 0)
    .map((block) => {
      const heading = block.sectionId ? (headingsBySectionId.get(block.sectionId) ?? null) : null;
      return {
        blockId: block.id,
        page: block.pageNumber ?? null,
        heading,
        text: trimBlockText(block.cleanText),
        score: scoreBlock(block, claimKeywords, heading),
      };
    })
    .sort((left, right) =>
      right.score - left.score
      || (right.text.length - left.text.length)
      || left.blockId.localeCompare(right.blockId),
    )
    .slice(0, maxBlocks);
}

function buildPrompt(input: {
  claimText: string;
  methodologyId?: string;
  methodologyVersion?: string;
  blocks: SemanticEvidenceBlock[];
}): string {
  const blockPayload = input.blocks.map((block) => ({
    block_id: block.blockId,
    page: block.page,
    heading: block.heading,
    text: block.text,
  }));

  return [
    "You are selecting evidence blocks for a PDF review question.",
    "Return JSON only. Do not use markdown fences. Do not add commentary.",
    "Return an array of objects with keys: block_id, page, exact_quote, reason, confidence.",
    "Rules:",
    "- exact_quote must be copied exactly from the provided block text.",
    "- block_id and page must match the chosen block.",
    "- confidence must be between 0 and 1.",
    "- Prefer the smallest number of strong candidates.",
    "- Return [] if no block clearly supports the question.",
    "",
    `Question: ${input.claimText}`,
    `Methodology: ${input.methodologyId || "unknown"} ${input.methodologyVersion || ""}`.trim(),
    "Candidate blocks:",
    JSON.stringify(blockPayload),
  ].join("\n");
}

function extractGeneratedText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item === "object" && "generated_text" in item && typeof item.generated_text === "string") {
        return item.generated_text;
      }
    }
  }
  if (payload && typeof payload === "object") {
    if ("generated_text" in payload && typeof payload.generated_text === "string") return payload.generated_text;
    if ("error" in payload && typeof payload.error === "string") throw new Error(payload.error);
  }
  throw new Error("Hugging Face response did not include generated text.");
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function validateCandidates(
  rawCandidates: z.infer<typeof llmResponseSchema>,
  blocks: SemanticEvidenceBlock[],
): SemanticEvidenceCandidate[] {
  const blockMap = new Map(blocks.map((block) => [block.blockId, block]));
  return rawCandidates
    .map((candidate) => {
      const block = blockMap.get(candidate.block_id);
      if (!block) return null;
      const page = candidate.page ?? null;
      if (block.page !== page) return null;
      if (!block.text.includes(candidate.exact_quote)) return null;
      return {
        blockId: block.blockId,
        page,
        heading: block.heading,
        quote: candidate.exact_quote,
        reason: candidate.reason.trim(),
        confidence: candidate.confidence,
      } satisfies SemanticEvidenceCandidate;
    })
    .filter((candidate): candidate is SemanticEvidenceCandidate => candidate !== null)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, MAX_RETURNED_CANDIDATES);
}

export async function suggestSemanticEvidenceCandidates(
  input: SemanticEvidenceInput,
  options?: {
    fetchImpl?: FetchLike;
    apiKey?: string | undefined;
  },
): Promise<SemanticEvidenceSuggestionResult> {
  if (!input.claimText.trim() || !input.rawPddText?.trim()) {
    return { status: "no_input", candidates: [], requestBlockCount: 0 };
  }

  const apiKey = options?.apiKey ?? process.env.HF_API_KEY;
  if (!apiKey) {
    return {
      status: "disabled",
      candidates: [],
      warning: "HF_API_KEY is not configured; semantic evidence suggestions are disabled.",
      requestBlockCount: 0,
    };
  }

  const parsedDocument = parseDocumentText({ rawText: input.rawPddText });
  const model = buildArticle6DocumentModel({ parsedDocument });
  const blocks = selectSemanticEvidenceBlocks(model, input.claimText);

  if (blocks.length === 0) {
    return {
      status: "no_input",
      candidates: [],
      warning: "No canonical document blocks were available for semantic evidence retrieval.",
      requestBlockCount: 0,
      parserAdapterId: model.parserAdapterId,
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const prompt = buildPrompt({
    claimText: input.claimText,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    blocks,
  });

  try {
    const response = await fetchImpl(HUGGING_FACE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 700,
          return_full_text: false,
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face request failed with ${response.status}`);
    }

    const payload = await response.json();
    const generatedText = extractGeneratedText(payload);
    const jsonArrayText = extractJsonArray(generatedText);
    if (!jsonArrayText) {
      return {
        status: "invalid_response",
        candidates: [],
        warning: "Semantic evidence model did not return a JSON array.",
        requestBlockCount: blocks.length,
        parserAdapterId: model.parserAdapterId,
      };
    }

    const parsedCandidates = llmResponseSchema.safeParse(JSON.parse(jsonArrayText));
    if (!parsedCandidates.success) {
      return {
        status: "invalid_response",
        candidates: [],
        warning: "Semantic evidence model returned JSON, but it did not match the expected shape.",
        requestBlockCount: blocks.length,
        parserAdapterId: model.parserAdapterId,
      };
    }

    const candidates = validateCandidates(parsedCandidates.data, blocks);
    return {
      status: "available",
      candidates,
      warning: candidates.length === 0
        ? "Semantic evidence model responded, but no candidates passed deterministic quote/block validation."
        : undefined,
      requestBlockCount: blocks.length,
      parserAdapterId: model.parserAdapterId,
    };
  } catch (error) {
    return {
      status: "request_failed",
      candidates: [],
      warning: error instanceof Error ? error.message : String(error),
      requestBlockCount: blocks.length,
      parserAdapterId: model.parserAdapterId,
    };
  }
}

