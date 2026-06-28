/**
 * Quick Check v2 — Phase 3 evidence retrieval with fixed source priority.
 *
 * Priority:
 * 1. fact contract
 * 2. exact section evidence
 * 3. raw text fallback
 *
 * Hard rules:
 * - No answer extraction
 * - No FOUND / UNCLEAR / MISSING status
 * - No scoring
 * - No candidate ranking
 * - No LLM
 */

import type { QuickCheckV2Block, QuickCheckV2ExtractedDocument } from "@/lib/quickCheckV2/ingestion";
import {
  CHECK_SECTION_MAPPINGS,
  buildSectionTree,
  findSectionsByHeadingText,
  type EvidenceSpan,
  type SectionTreeNode,
} from "@/lib/quickCheckV2/section-tree";

export const STRUCTURED_CHECK_IDS = [
  "host_country",
  "methodology",
  "baseline_scenario",
  "additionality",
  "leakage",
  "stakeholder_consultation",
] as const;

export type StructuredCheckId = (typeof STRUCTURED_CHECK_IDS)[number];

export type EvidenceSourceType =
  | "fact_contract"
  | "exact_section"
  | "raw_text_fallback";

export type RetrievedEvidence = EvidenceSpan & {
  sourceType: EvidenceSourceType;
};

export type RetrievedCheckEvidence = {
  checkName: StructuredCheckId;
  evidence: RetrievedEvidence | null;
};

type FactContractDefinition = {
  find(blocks: QuickCheckV2Block[]): QuickCheckV2Block | null;
};

type RawFallbackDefinition = {
  match(block: QuickCheckV2Block): boolean;
};

const FACT_CONTRACTS: Partial<Record<StructuredCheckId, FactContractDefinition>> = {
  host_country: {
    find(blocks) {
      return (
        findFirstBlock(blocks, (block) =>
          /\blocated\b/i.test(block.text) && /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bproject location\b/i.test(block.sectionHeading ?? "") &&
          /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text),
        ) ??
        null
      );
    },
  },
  methodology: {
    find(blocks) {
      return (
        findFirstBlock(blocks, (block) =>
          /\bVM\d{4}\b|\bVMD\d{4}\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bmethodology\b/i.test(block.text),
        ) ??
        null
      );
    },
  },
};

const RAW_TEXT_FALLBACKS: Record<StructuredCheckId, RawFallbackDefinition> = {
  host_country: {
    match(block) {
      return (
        /\blocated\b/i.test(block.text) &&
        /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text)
      );
    },
  },
  methodology: {
    match(block) {
      return /\bVM\d{4}\b|\bVMD\d{4}\b|\bmethodology\b/i.test(block.text);
    },
  },
  baseline_scenario: {
    match(block) {
      return /\bbaseline scenario\b|\bmost likely baseline\b/i.test(block.text);
    },
  },
  additionality: {
    match(block) {
      return /\badditionality\b|\badditional\b/i.test(block.text);
    },
  },
  leakage: {
    match(block) {
      return /\bleakage\b/i.test(block.text);
    },
  },
  stakeholder_consultation: {
    match(block) {
      return /\bstakeholder\b|\bconsultation\b/i.test(block.text);
    },
  },
};

function isEvidenceBlock(block: QuickCheckV2Block): boolean {
  return block.blockType === "body" || block.blockType === "table";
}

function getEvidenceBlocks(document: QuickCheckV2ExtractedDocument): QuickCheckV2Block[] {
  return document.blocks.filter(isEvidenceBlock);
}

function findFirstBlock(
  blocks: QuickCheckV2Block[],
  predicate: (block: QuickCheckV2Block) => boolean,
): QuickCheckV2Block | null {
  for (const block of blocks) {
    if (predicate(block)) {
      return block;
    }
  }
  return null;
}

function toEvidence(
  block: QuickCheckV2Block,
  sourceType: EvidenceSourceType,
): RetrievedEvidence {
  return {
    sourceType,
    quote: block.text,
    page: block.page,
    sectionHeading: block.sectionHeading,
    sectionPath: block.sectionPath,
    spanId: block.spanId,
  };
}

function getBestExactSectionBlock(
  tree: SectionTreeNode[],
  checkName: StructuredCheckId,
): QuickCheckV2Block | null {
  const mapping = CHECK_SECTION_MAPPINGS[checkName];
  if (!mapping) {
    return null;
  }

  let sections = findSectionsByHeadingText(
    tree,
    mapping.searchTexts,
    3,
    mapping.excludeTexts,
  );

  if (sections.length === 0 && mapping.fallbackSearchTexts) {
    sections = findSectionsByHeadingText(
      tree,
      mapping.fallbackSearchTexts,
      3,
      mapping.excludeTexts,
    );
  }

  if (sections.length === 0) {
    return null;
  }

  const bestSection =
    sections.find((section) => section.directBodyBlocks.length > 0 && section.heading.page > 2) ??
    sections.find((section) => section.directBodyBlocks.length > 0) ??
    null;

  return bestSection?.directBodyBlocks[0] ?? null;
}

function getFactContractEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const definition = FACT_CONTRACTS[checkName];
  if (!definition) {
    return null;
  }

  const block = definition.find(getEvidenceBlocks(document));
  return block ? toEvidence(block, "fact_contract") : null;
}

function getExactSectionEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const block = getBestExactSectionBlock(buildSectionTree(document), checkName);
  return block ? toEvidence(block, "exact_section") : null;
}

function getRawTextFallbackEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const definition = RAW_TEXT_FALLBACKS[checkName];
  const block = findFirstBlock(getEvidenceBlocks(document), definition.match);
  return block ? toEvidence(block, "raw_text_fallback") : null;
}

export function retrieveEvidenceForCheck(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedCheckEvidence {
  const evidence =
    getFactContractEvidence(document, checkName) ??
    getExactSectionEvidence(document, checkName) ??
    getRawTextFallbackEvidence(document, checkName);

  return {
    checkName,
    evidence,
  };
}

export function retrieveEvidenceForAllChecks(
  document: QuickCheckV2ExtractedDocument,
): RetrievedCheckEvidence[] {
  return STRUCTURED_CHECK_IDS.map((checkName) =>
    retrieveEvidenceForCheck(document, checkName),
  );
}
