/**
 * Quick Check v2 — Section tree and evidence span index.
 *
 * Phase 2: Build a section tree from canonical extracted JSON blocks,
 * then build an evidence span index that returns direct body blocks
 * under exact section headings for each of the six structured checks.
 *
 * Hard rules:
 * - No descendant section sweeping (direct body only)
 * - No answer extraction
 * - No FOUND / UNCLEAR / MISSING status
 * - No scoring
 * - No LLM
 */

import type { QuickCheckV2ExtractedDocument, QuickCheckV2Block } from "@/lib/quickCheckV2/ingestion";

// ---------------------------------------------------------------------------
// Section tree types
// ---------------------------------------------------------------------------

/**
 * A node in the section tree.
 *
 * Each node corresponds to a heading block in the canonical document.
 * The `children` list contains subsections (heading blocks nested under
 * this one). The `blocks` list contains body/table blocks that are DIRECT
 * children of this section (not inherited from descendants).
 */
export type SectionTreeNode = {
  /** The heading block that defines this section */
  heading: QuickCheckV2Block;
  /** Direct body/table blocks under this section (no descendant sweeping) */
  directBodyBlocks: QuickCheckV2Block[];
  /** Child subsections */
  children: SectionTreeNode[];
};

// ---------------------------------------------------------------------------
// Evidence span types
// ---------------------------------------------------------------------------

/**
 * An evidence span is a single block with full provenance.
 *
 * This is the smallest unit of evidence the system can return.
 * Every evidence span has a quote (the text), a page number,
 * the section heading it belongs to, the full section path,
 * and a stable spanId.
 */
export type EvidenceSpan = {
  /** The extracted text (the "quote") */
  quote: string;
  /** Page number */
  page: number;
  /** The nearest section heading text */
  sectionHeading: string | null;
  /** The full section path from the document */
  sectionPath: string[];
  /** Stable span identifier */
  spanId: string;
};

/**
 * The result of a single check's evidence retrieval.
 *
 * If `span` is present, the check found direct evidence in the
 * correct section. If `span` is null, no direct body text was
 * found under the expected section heading for that check.
 */
export type CheckEvidenceResult = {
  /** Which check this evidence is for */
  checkName: string;
  /** The best evidence span, or null if no direct evidence found */
  span: EvidenceSpan | null;
  /** The section heading(s) that were searched */
  searchedSections: string[];
};

// ---------------------------------------------------------------------------
// Known check → section heading mappings for Envira-style VCS PDDs
// ---------------------------------------------------------------------------

/**
 * For each of the six structured checks, defines which section heading(s)
 * to search for direct evidence.
 *
 * The key is a unique check identifier (lowercase, underscore-separated).
 *
 * Each check specifies:
 * - `searchTexts`: Substrings to match against heading block text to find
 *   the target section(s). Case-insensitive matching.
 * - `fallbackSearchTexts`: Additional heading substrings to try if the
 *   primary search finds no section.
 *
 * These mappings are NOT PDD-specific — they should work for any VCS PDD
 * that follows the standard VCS section numbering scheme.
 */
export const CHECK_SECTION_MAPPINGS: Record<
  string,
  {
    label: string;
    searchTexts: string[];
    fallbackSearchTexts?: string[];
    excludeTexts?: string[];
  }
> = {
  host_country: {
    label: "Host country",
    searchTexts: ["Project Location"],
    fallbackSearchTexts: ["PROJECT DETAILS"],
  },
  methodology: {
    label: "Methodology",
    searchTexts: ["Title and Reference of Methodology"],
    fallbackSearchTexts: ["APPLICATION OF METHODOLOGY"],
  },
  baseline_scenario: {
    label: "Baseline scenario",
    searchTexts: [
      "Baseline Scenario",
      "Description of how the baseline scenario is identified",
      "Details of the baseline and its development",
    ],
  },
  additionality: {
    label: "Additionality",
    searchTexts: ["Additionality"],
  },
  leakage: {
    label: "Leakage",
    searchTexts: ["Leakage"],
    // Use a numeric prefix pattern to distinguish "3.3 Leakage" from
    // "2.3.1 ... Baseline, Project and Leakage" which is a sub-heading
    // about leakage emissions sources, not the main Leakage section
    excludeTexts: ["Baseline, Project and Leakage"],
  },
  stakeholder_consultation: {
    label: "Stakeholder consultation",
    searchTexts: ["STAKEHOLDER COMMENTS", "Stakeholder Comments"],
    fallbackSearchTexts: ["stakeholder"],
  },
};

// ---------------------------------------------------------------------------
// Section tree builder
// ---------------------------------------------------------------------------

/**
 * Build a section tree from a canonical extracted document.
 *
 * Walks the document's blocks in order, identifying heading blocks
 * and grouping body/table blocks under their nearest heading ancestor.
 *
 * The tree structure reflects the document's heading hierarchy:
 * Section "1" → children ["1.1", "1.2", ...]
 * Section "2.4" → children ["2.4.1", "2.4.2", ...]
 *
 * @param document The canonical extracted document (from Phase 1)
 * @returns An ordered list of top-level section nodes.
 */
export function buildSectionTree(
  document: QuickCheckV2ExtractedDocument,
): SectionTreeNode[] {
  const rootNodes: SectionTreeNode[] = [];
  const stack: SectionTreeNode[] = [];

  for (const block of document.blocks) {
    if (block.blockType === "heading") {
      const node: SectionTreeNode = {
        heading: block,
        directBodyBlocks: [],
        children: [],
      };

      // Determine the correct parent by depth of the section path
      // If depth is 0 (no section number), treat as top-level
      const depth = block.sectionPath.length || 1;

      // Pop the stack until we find the parent at depth - 1
      while (stack.length >= depth) {
        stack.pop();
      }

      if (stack.length > 0) {
        // This node is a child of the node on top of the stack
        const parent = stack[stack.length - 1]!;
        parent.children.push(node);
      } else {
        // This is a top-level section
        rootNodes.push(node);
      }

      stack.push(node);
    } else if (block.blockType === "body" || block.blockType === "table") {
      // Assign this block to the current section (top of stack)
      if (stack.length > 0) {
        const currentSection = stack[stack.length - 1]!;
        currentSection.directBodyBlocks.push(block);
      }
      // If no section is active (before first heading), ignore the block
    }
  }

  return rootNodes;
}

// ---------------------------------------------------------------------------
// Section tree search utilities
// ---------------------------------------------------------------------------

/**
 * Find all section nodes whose heading text contains one of the given
 * substrings (case-insensitive).
 *
 * Searches the full tree recursively. Returns at most `maxResults` nodes.
 */
export function findSectionsByHeadingText(
  tree: SectionTreeNode[],
  searchTexts: string[],
  maxResults: number = 3,
  excludeTexts?: string[],
): SectionTreeNode[] {
  const results: SectionTreeNode[] = [];

  function walk(nodes: SectionTreeNode[]) {
    for (const node of nodes) {
      const headingText = node.heading.text.toLowerCase();
      if (searchTexts.some((t) => headingText.includes(t.toLowerCase()))) {
        // Skip if this heading matches any exclusion text
        if (
          excludeTexts &&
          excludeTexts.some((e) => headingText.includes(e.toLowerCase()))
        ) {
          // Check children in case the real section is nested deeper
          if (results.length < maxResults) {
            walk(node.children);
          }
          continue;
        }
        results.push(node);
        if (results.length >= maxResults) return;
      }
      if (results.length < maxResults) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return results;
}

/**
 * Collect all direct body blocks from a section node, joined into a
 * single text string.
 */
export function getDirectBodyText(node: SectionTreeNode): string {
  return node.directBodyBlocks.map((b) => b.text).join("\n");
}

// ---------------------------------------------------------------------------
// Evidence span index
// ---------------------------------------------------------------------------

/**
 * Build an evidence span index: for each of the six checks, find the
 * best evidence span from the correct section.
 *
 * Strategy:
 * 1. Build the section tree from the canonical document.
 * 2. For each check, look up the target section(s) by heading text.
 * 3. Return the first body block under the matched section as evidence.
 *    (Since blocks are in document order, the first body block under
 *    a section is the best evidence — it's the immediate descriptive text.)
 *
 * This is intentionally simple — no scoring, no ranking, no LLM.
 * Just "find the section, return the first body block."
 *
 * @param document The canonical extracted document (from Phase 1)
 * @returns An array of CheckEvidenceResult, one per structured check.
 */
export function buildEvidenceIndex(
  document: QuickCheckV2ExtractedDocument,
): CheckEvidenceResult[] {
  const tree = buildSectionTree(document);
  const results: CheckEvidenceResult[] = [];

  for (const [checkName, mapping] of Object.entries(CHECK_SECTION_MAPPINGS)) {
    // Primary search
    let sections = findSectionsByHeadingText(
      tree,
      mapping.searchTexts,
      3,
      mapping.excludeTexts,
    );

    // Fallback if primary search found nothing
    if (sections.length === 0 && mapping.fallbackSearchTexts) {
      sections = findSectionsByHeadingText(
        tree,
        mapping.fallbackSearchTexts,
        3,
        mapping.excludeTexts,
      );
    }

    const searchedSections = [
      ...mapping.searchTexts,
      ...(mapping.fallbackSearchTexts ?? []),
    ];

    // Get the best evidence span from the matched section
    let span: EvidenceSpan | null = null;

    if (sections.length > 0) {
      // Prefer sections on real content pages with body blocks
      // (not TOC entries on page 2 which have empty body blocks)
      const bestSection =
        sections.find(
          (s) =>
            s.directBodyBlocks.length > 0 && s.heading.page > 2,
        ) ??
        sections.find((s) => s.directBodyBlocks.length > 0) ??
        sections[0]!;

      const firstBody = bestSection.directBodyBlocks[0];

      if (firstBody) {
        span = {
          quote: firstBody.text,
          page: firstBody.page,
          sectionHeading: bestSection.heading.text,
          sectionPath: bestSection.heading.sectionPath,
          spanId: firstBody.spanId,
        };
      }
    }

    results.push({
      checkName,
      span,
      searchedSections,
    });
  }

  return results;
}

/**
 * Convenience function: run evidence retrieval for a single check.
 *
 * @param document The canonical extracted document
 * @param checkName One of: "host_country", "methodology", "baseline_scenario",
 *                  "additionality", "leakage", "stakeholder_consultation"
 * @returns The evidence result for that check
 */
export function getEvidenceForCheck(
  document: QuickCheckV2ExtractedDocument,
  checkName: string,
): CheckEvidenceResult {
  const results = buildEvidenceIndex(document);
  const result = results.find((r) => r.checkName === checkName);

  if (!result) {
    return {
      checkName,
      span: null,
      searchedSections: [],
    };
  }

  return result;
}
