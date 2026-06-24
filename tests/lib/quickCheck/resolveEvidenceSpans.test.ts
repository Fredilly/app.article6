import { describe, expect, test } from "@jest/globals";
import { resolveEvidenceSpans, pagesFromResolvedSpans, sectionsFromResolvedSpans, quotesFromResolvedSpans } from "@/lib/quickCheck/evidence/resolveEvidenceSpans";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";

function makeTestDoc(overrides: Partial<EvidenceDocument>): EvidenceDocument {
  return {
    docId: "test-doc",
    rawText: overrides.rawText ?? "",
    spans: overrides.spans ?? [],
  };
}

function makeSpan(overrides: Record<string, unknown>): EvidenceDocument["spans"][number] {
  return {
    spanId: (overrides.spanId as string) ?? "span:1",
    docId: "test-doc",
    page: "page" in overrides ? (overrides.page as number | null) : 1,
    sectionId: (overrides.sectionId as string) ?? undefined,
    heading: (overrides.heading as string) ?? undefined,
    headingPath: (overrides.headingPath as string[]) ?? [],
    sectionPath: (overrides.sectionPath as string[]) ?? [],
    blockType: (overrides.blockType as string) ?? "paragraph",
    text: (overrides.text as string) ?? "Test text",
    normalizedText: (overrides.normalizedText as string) ?? "test text",
    charStart: (overrides.charStart as number | null) ?? 0,
    charEnd: (overrides.charEnd as number | null) ?? 9,
    reliability: (overrides.reliability as string) ?? "primary",
    confidence: (overrides.confidence as number) ?? 0.9,
    table: (overrides.table as EvidenceDocument["spans"][number]["table"]) ?? undefined,
  } as EvidenceDocument["spans"][number];
}

describe("resolveEvidenceSpans", () => {
  test("resolves valid span IDs to span data", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "span:1", page: 5, text: "Section 4.2.4 body text" }),
        makeSpan({ spanId: "span:2", page: 3, text: "Methodology description" }),
      ],
    });

    const result = resolveEvidenceSpans(["span:1"], doc);
    expect(result.allResolved).toBe(true);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].page).toBe(5);
    expect(result.resolved[0].spanId).toBe("span:1");
    expect(result.warnings).toHaveLength(0);
  });

  test("flags unresolved span IDs with warnings", () => {
    const doc = makeTestDoc({
      spans: [makeSpan({ spanId: "span:1", page: 1 })],
    });

    const result = resolveEvidenceSpans(["span:missing", "span:also-missing"], doc);
    expect(result.allResolved).toBe(false);
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolvedIds).toHaveLength(2);
    expect(result.warnings).toContain("All evidenceSpanIds failed to resolve — provenance is lost");
  });

  test("handles mixed resolved and unresolved IDs", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "span:1", page: 7 }),
        makeSpan({ spanId: "span:2", page: 8 }),
      ],
    });

    const result = resolveEvidenceSpans(["span:1", "span:missing"], doc);
    expect(result.allResolved).toBe(false);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].page).toBe(7);
    expect(result.unresolvedIds).toEqual(["span:missing"]);
    expect(result.warnings).toHaveLength(1);
  });

  test("returns correct page numbers from resolved spans", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "s1", page: 3 }),
        makeSpan({ spanId: "s2", page: 5 }),
        makeSpan({ spanId: "s3", page: 3 }),
      ],
    });

    const result = resolveEvidenceSpans(["s1", "s2", "s3"], doc);
    expect(pagesFromResolvedSpans(result)).toEqual([3, 5]);
  });

  test("returns empty pages when spans have no page", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "s1", page: null, text: "No page number" }),
      ],
    });

    const result = resolveEvidenceSpans(["s1"], doc);
    expect(pagesFromResolvedSpans(result)).toEqual([]);
  });

  test("quotesFromResolvedSpans returns deduped span text", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "s1", text: "Baseline scenario description", page: 5 }),
        makeSpan({ spanId: "s2", text: "Same text appears here too", page: 6 }),
      ],
    });

    const result = resolveEvidenceSpans(["s1", "s2"], doc);
    expect(quotesFromResolvedSpans(result)).toEqual([
      "Baseline scenario description",
      "Same text appears here too",
    ]);
  });

  test("sectionsFromResolvedSpans returns deduped section paths", () => {
    const doc = makeTestDoc({
      spans: [
        makeSpan({ spanId: "s1", sectionPath: ["section:4", "section:4.2", "section:4.2.4"], page: 15 }),
      ],
    });

    const result = resolveEvidenceSpans(["s1"], doc);
    expect(sectionsFromResolvedSpans(result)).toEqual(["section:4 > section:4.2 > section:4.2.4"]);
  });
});
