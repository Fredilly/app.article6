import { describe, expect, it } from "@jest/globals";
import {
  evidenceToStackItem,
  getPrimaryEvidence,
  groupEvidenceStackByRole,
  hasPrimaryEvidence,
  normalizeEvidenceStack,
  sortEvidenceStack,
  validateEvidenceStack,
  validateEvidenceStackForStatus,
} from "@/lib/evidence/evidenceStack";

describe("Evidence Stack", () => {
  it("validates allowed roles", () => {
    const result = validateEvidenceStack([
      { role: "primary", page: 12, quote: "Primary quote." },
      { role: "supporting", page: 13, quote: "Supporting quote." },
      { role: "caveat", page: 14, quote: "Caveat quote." },
      { role: "blocker", page: 15, quote: "Blocker quote." },
    ]);

    expect(result).toStrictEqual({ valid: true, errors: [] });
  });

  it("rejects unknown roles", () => {
    const result = validateEvidenceStack([
      { role: "unknown" as never, page: 12, quote: "Quote." },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('stack[0] has an invalid role "unknown"');
  });

  it("rejects missing or invalid page values", () => {
    const result = validateEvidenceStack([
      { role: "primary", page: 0, quote: "Quote." },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("stack[0] must have a finite positive page number");
  });

  it("rejects empty quotes", () => {
    const result = validateEvidenceStack([
      { role: "primary", page: 3, quote: "   " },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("stack[0] must have a non-empty quote");
  });

  it("sorts primary, supporting, caveat, and blocker in that order", () => {
    const sorted = sortEvidenceStack([
      { role: "blocker", page: 4, quote: "Blocker." },
      { role: "supporting", page: 2, quote: "Supporting." },
      { role: "primary", page: 1, quote: "Primary." },
      { role: "caveat", page: 3, quote: "Caveat." },
    ]);

    expect(sorted.map((item) => item.role)).toStrictEqual([
      "primary",
      "supporting",
      "caveat",
      "blocker",
    ]);
  });

  it("preserves original order within each role", () => {
    const sorted = sortEvidenceStack([
      { role: "supporting", page: 2, quote: "Supporting A." },
      { role: "supporting", page: 3, quote: "Supporting B." },
      { role: "primary", page: 1, quote: "Primary." },
      { role: "caveat", page: 4, quote: "Caveat A." },
      { role: "caveat", page: 5, quote: "Caveat B." },
    ]);

    expect(sorted.map((item) => item.quote)).toStrictEqual([
      "Primary.",
      "Supporting A.",
      "Supporting B.",
      "Caveat A.",
      "Caveat B.",
    ]);
  });

  it("returns the first primary evidence item", () => {
    const stack = normalizeEvidenceStack([
      { role: "supporting", page: 2, quote: "Supporting." },
      { role: "primary", page: 1, quote: "Primary A." },
      { role: "primary", page: 3, quote: "Primary B." },
    ]);

    expect(getPrimaryEvidence(stack)?.quote).toBe("Primary A.");
    expect(hasPrimaryEvidence(stack)).toBe(true);
  });

  it("groups items by role without dropping caveats or blockers", () => {
    const grouped = groupEvidenceStackByRole([
      { role: "primary", page: 1, quote: "Primary." },
      { role: "caveat", page: 2, quote: "Caveat." },
      { role: "blocker", page: 3, quote: "Blocker." },
    ]);

    expect(grouped.primary).toHaveLength(1);
    expect(grouped.caveat).toHaveLength(1);
    expect(grouped.blocker).toHaveLength(1);
  });

  it("rejects FOUND without primary evidence", () => {
    const result = validateEvidenceStackForStatus("FOUND", [
      { role: "supporting", page: 2, quote: "Supporting only." },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("FOUND/answered evidence requires at least one primary citation");
  });

  it("builds a normalized stack item from legacy evidence", () => {
    expect(
      evidenceToStackItem({
        page: 8,
        quote: "Legacy quote.",
        sectionHeading: "Section 2",
        sectionPath: ["2"],
        spanId: "doc:p8:b1",
        sourceType: "exact_section",
      }),
    ).toStrictEqual({
      role: "primary",
      page: 8,
      quote: "Legacy quote.",
      sectionHeading: "Section 2",
      sectionPath: ["2"],
      spanId: "doc:p8:b1",
      sourceType: "exact_section",
      label: undefined,
      reason: undefined,
    });
  });
});
