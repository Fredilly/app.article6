import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";
import {
  buildVm0007Rc3SelectedMatchSubtaxonomy,
  classifySelectedMatchSubtype,
  SELECTED_MATCH_SUBTYPES,
  serializeVm0007Rc3SelectedMatchSubtaxonomy,
  validateVm0007Rc3SelectedMatchSubtaxonomy,
  type SelectedMatchComparison,
} from "@/lib/preverif/vm0007Rc3SelectedMatchSubtaxonomy";
import type { Vm0007EvidenceBenchmarkMachineRow, Vm0007EvidenceBenchmarkReviewedRow } from "@/lib/preverif/vm0007EvidenceBenchmark";
import type { Vm0007Rc3Diagnostic } from "@/lib/preverif/vm0007Rc3Diagnostic";

const root = process.cwd();
const artifactPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3/RC3_SELECTED_MATCH_SUBTAXONOMY.json");
const baselinePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2/RC2_BASELINE.json");

function artifact() {
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function comparison(overrides: Partial<SelectedMatchComparison> = {}): SelectedMatchComparison {
  return {
    reviewedQuote: "reviewed quote",
    machineQuote: "machine quote",
    selectedCandidateQuotes: ["selected quote"],
    selectedCandidateSpanIds: ["selected-span"],
    emittedSpanIds: ["emitted-span"],
    selectedCandidateNotEmitted: false,
    emittedQuoteDiffersFromSelectedCandidate: false,
    duplicateCardinalityMismatch: false,
    normalizationOnlyDifference: false,
    materialTokenOverlap: false,
    reviewedContainsMachine: false,
    machineContainsReviewed: false,
    reviewedNormalizedQuoteCount: 1,
    emittedNormalizedQuoteCount: 1,
    reviewedDuplicateNormalizedQuoteCount: 0,
    emittedDuplicateNormalizedQuoteCount: 0,
    fixtureRuntimeDrift: false,
    otherProvenMismatch: false,
    ...overrides,
  };
}

const provenance = (spanId: string) => ({ docId: "doc-1", page: 1, sectionPath: ["Evidence"], spanId, sectionHeading: "Evidence", sourceType: "PDD" });
const candidate = (quote: string, spanId: string) => ({ spanId, quote, page: 1, score: 10, evidenceType: "project_specific_implementation" as const, rejectionReason: null });
const event = (eventId: string, quote: string, selected: ReturnType<typeof candidate>[]) => ({
  eventId, stableRuleId: "rule-1", reviewedEvidence: { quote, provenance: { ...provenance(`reviewed-${eventId}`), spanId: `reviewed-${eventId}` } }, primaryCause: "selected_but_match_failed" as const,
  detail: { code: "stage_proven_by_opt_in_trace", sourceCorpusContainsReviewedQuote: true, retrievalCandidates: selected, postFilterCandidates: selected, selectedCandidates: selected, benchmarkMatchingResult: "false_negative" as const, cutoffPosition: 6, note: "synthetic" },
});
const diagnostic = (events: ReturnType<typeof event>[]) => ({ events } as unknown as Vm0007Rc3Diagnostic);
const machine = (acceptedEvidence: unknown[]): Vm0007EvidenceBenchmarkMachineRow => ({ stableRuleId: "rule-1", acceptedEvidence });
const reviewed = (acceptedEvidence: unknown[]): Vm0007EvidenceBenchmarkReviewedRow => ({ ruleId: "rule-1", acceptedEvidence });
const buildSynthetic = (events: ReturnType<typeof event>[], machineRows: Vm0007EvidenceBenchmarkMachineRow[], reviewedRows: Vm0007EvidenceBenchmarkReviewedRow[]) => buildVm0007Rc3SelectedMatchSubtaxonomy({ diagnostic: diagnostic(events), machineRows, reviewedRows, baseline: { artifactPath: "RC2_BASELINE.json", artifactSha256: "sha" } });

describe("RC3-2 selected-match subtype taxonomy", () => {
  it("accounts for all 47 parent events exactly once and sums subtype counts", () => {
    const value = artifact();
    expect(value.parentCategory).toEqual({ name: "selected_but_match_failed", count: 47 });
    expect(value.events).toHaveLength(47);
    expect(new Set(value.events.map((event: { eventId: string }) => event.eventId)).size).toBe(47);
    expect(Object.values(value.subtypeCounts).reduce((sum: number, count) => sum + count, 0)).toBe(47);
    expect(value.events.every((event: { primarySubtype: string }) => SELECTED_MATCH_SUBTYPES.includes(event.primarySubtype as never))).toBe(true);
  });

  it("rejects duplicate and missing event IDs", () => {
    const value = artifact();
    expect(() => validateVm0007Rc3SelectedMatchSubtaxonomy({ ...value, events: [...value.events.slice(0, -1), value.events[0]] })).toThrow("Duplicate selected-match subtype event ID");
    expect(() => validateVm0007Rc3SelectedMatchSubtaxonomy({ ...value, events: value.events.slice(0, -1) })).toThrow("does not equal parent count");
  });

  it("tests each subtype branch independently", () => {
    const cases: Array<[SelectedMatchComparison, string]> = [
      [comparison({ machineContainsReviewed: true }), "machine_quote_superset_of_reviewed"],
      [comparison({ reviewedContainsMachine: true }), "reviewed_quote_superset_of_machine"],
      [comparison({ materialTokenOverlap: true }), "partial_overlap_without_containment"],
      [comparison({ selectedCandidateNotEmitted: true }), "selected_candidate_not_emitted"],
      [comparison({ emittedQuoteDiffersFromSelectedCandidate: true, selectedCandidateNotEmitted: false }), "emitted_quote_differs_from_selected_candidate"],
      [comparison({ duplicateCardinalityMismatch: true }), "duplicate_cardinality_mismatch"],
      [comparison({ normalizationOnlyDifference: true }), "normalization_gap"],
      [comparison({ fixtureRuntimeDrift: true }), "fixture_runtime_drift"],
      [comparison({ otherProvenMismatch: true }), "other_proven_mismatch"],
      [comparison(), "unresolved_insufficient_evidence"],
    ];
    for (const [input, expected] of cases) expect(classifySelectedMatchSubtype(input)).toBe(expected);
  });

  it("distinguishes selected-not-emitted from emitted-different-from-selected", () => {
    expect(classifySelectedMatchSubtype(comparison({ selectedCandidateNotEmitted: true }))).toBe("selected_candidate_not_emitted");
    expect(classifySelectedMatchSubtype(comparison({ emittedQuoteDiffersFromSelectedCandidate: true }))).toBe("emitted_quote_differs_from_selected_candidate");
  });

  it("proves builder-level emission and cardinality cases from synthetic rows", () => {
    const present = buildSynthetic(
      [event("present", "reviewed", [candidate("reviewed", "span-1")])],
      [machine([{ quote: "reviewed", provenance: provenance("span-1") }])],
      [reviewed([{ quote: "reviewed", provenance: provenance("reviewed-present") }])],
    );
    expect(present.events[0].primarySubtype).not.toBe("selected_candidate_not_emitted");

    const absent = buildSynthetic(
      [event("absent", "reviewed", [candidate("reviewed passage", "selected-span")])],
      [machine([{ quote: "other", provenance: provenance("other-span") }])],
      [reviewed([{ quote: "reviewed", provenance: provenance("reviewed-absent") }])],
    );
    expect(absent.events[0].primarySubtype).toBe("selected_candidate_not_emitted");

    const changed = buildSynthetic(
      [event("changed", "reviewed", [candidate("selected passage", "same-span")])],
      [machine([{ quote: "changed passage", provenance: provenance("same-span") }])],
      [reviewed([{ quote: "reviewed", provenance: provenance("reviewed-changed") }])],
    );
    expect(changed.events[0].primarySubtype).toBe("emitted_quote_differs_from_selected_candidate");

    const distinct = buildSynthetic(
      [event("distinct-1", "first", [candidate("first", "span-1")]), event("distinct-2", "second", [candidate("second", "span-2")])],
      [machine([{ quote: "first", provenance: provenance("span-1") }, { quote: "second", provenance: provenance("span-2") }])],
      [reviewed([{ quote: "first", provenance: provenance("reviewed-first") }, { quote: "second", provenance: provenance("reviewed-second") }])],
    );
    expect(distinct.events.every((item) => item.normalizedComparison.duplicateCardinalityMismatch === false)).toBe(true);

    const duplicate = buildSynthetic(
      [event("duplicate-1", "same", [candidate("same", "span-1")]), event("duplicate-2", "same", [candidate("same", "span-2")])],
      [machine([{ quote: "same", provenance: provenance("span-1") }])],
      [reviewed([{ quote: "same", provenance: provenance("reviewed-1") }, { quote: "same", provenance: provenance("reviewed-2") }])],
    );
    expect(duplicate.events.every((item) => item.primarySubtype === "duplicate_cardinality_mismatch")).toBe(true);
  });

  it("fails closed when either aligned row is missing", () => {
    const item = event("missing", "reviewed", [candidate("reviewed", "span-1")]);
    expect(() => buildSynthetic([item], [], [reviewed([{ quote: "reviewed" }])])).toThrow("missing machine row");
    expect(() => buildSynthetic([item], [machine([{ quote: "reviewed", provenance: provenance("span-1") }])], [])).toThrow("missing reviewed row");
  });

  it("leaves an ambiguous comparison unresolved", () => {
    expect(classifySelectedMatchSubtype(comparison())).toBe("unresolved_insufficient_evidence");
  });

  it("keeps the frozen RC2 baseline identity", () => {
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const sha = crypto.createHash("sha256").update(fs.readFileSync(baselinePath)).digest("hex");
    expect(sha).toBe("15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf");
  });

  it("serializes the generated artifact deterministically", () => {
    const value = artifact();
    expect(serializeVm0007Rc3SelectedMatchSubtaxonomy(value)).toBe(fs.readFileSync(artifactPath, "utf8"));
    expect(value).not.toHaveProperty("generatedAt");
    expect(value).not.toHaveProperty("timestamp");
  });
});
