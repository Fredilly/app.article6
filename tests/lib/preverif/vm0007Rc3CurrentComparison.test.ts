import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { buildVm0007Rc3CurrentComparison, serializeVm0007Rc3CurrentComparison } from "@/lib/preverif/vm0007Rc3CurrentComparison";

const root = process.cwd();
const artifactPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC3_CURRENT_COMPARISON.json");
const provenance = (spanId: string) => ({ docId: "doc", page: 1, sectionPath: ["S"], spanId, sectionHeading: "S", sourceType: "PDD" });
const evidence = (quote: string, spanId: string) => ({ quote, provenance: provenance(spanId) });
const ids = Array.from({ length: 58 }, (_, index) => `rule-${String(index + 1).padStart(2, "0")}`);
const reviewedRows = ids.map((ruleId) => ({ ruleId, finalEvidenceState: "FOUND", applicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE_IDENTIFIED", draftFindingCandidate: null, clientAction: "retain", acceptedEvidence: [evidence("reviewed evidence", `${ruleId}-span`)], rejectedEvidence: [] }));
const row = (ruleId: string, quote = "reviewed evidence") => ({ stableRuleId: ruleId, upstreamStatus: "FOUND", proposedApplicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE_IDENTIFIED", draftFindingCandidate: null, clientAction: "retain", acceptedEvidence: [evidence(quote, `${ruleId}-span`)], rejectedEvidence: [] });
const build = (currentRows = ids.map((id) => row(id)), frozenRows = ids.map((id) => ({ ...row(id), acceptedEvidence: [] }))) => buildVm0007Rc3CurrentComparison({
  currentRows: currentRows as any,
  frozenRows: frozenRows as any,
  reviewedRows: reviewedRows as any,
  expectedStableRuleIds: ids,
  frozenRc2: { path: "RC2_BASELINE.json", sha256: "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf", baseline: { aggregate: { acceptedEvidence: { falseNegativeCount: 58, falsePositiveCount: 0 } } } },
  frozenProposal: { path: "machine-proposal.json", sha256: "frozen-sha" },
  reviewedTruth: { path: "gold.json", sha256: "gold-sha" },
  currentProposal: { serialized: JSON.stringify({ rows: currentRows }), auditExecutionSha256: "audit-sha", sourceExtractionSha256: "extraction-sha" },
  diagnosticTrace: [],
  frozenRc2Unchanged: true,
  frozenProposalUnchanged: true,
  reviewedTruthUnchanged: true,
});

describe("RC3-4 current same-run proposal comparison", () => {
  it("benchmarks the current rows independently from the frozen proposal", () => {
    const value = build();
    expect(value.ruleCount).toBe(58);
    expect(value.metrics.acceptedEvidenceMissed.current).toBe(0);
    expect(value.metrics.acceptedEvidenceMissed.frozenRc2).toBe(58);
    expect(value.metrics.acceptedEvidenceMissed.delta).toBe(-58);
    expect(value.recoveredEventIds.acceptedEvidenceMissed).toHaveLength(58);
    expect(value.regressedEventIds.acceptedEvidenceMissed).toHaveLength(0);
  });

  it("cannot silently replace the current proposal with a changed frozen proposal", () => {
    const current = build();
    const changedFrozen = ids.map((id) => ({ ...row(id), acceptedEvidence: [], clientAction: "different frozen proposal" }));
    const stillCurrent = build(undefined, changedFrozen);
    expect(stillCurrent.metrics.acceptedEvidenceMissed.current).toBe(current.metrics.acceptedEvidenceMissed.current);
    expect(stillCurrent.currentProposalSource.kind).toBe("same_run_serialized_reload");
  });

  it("reconciles recovered and regressed sets with metric deltas", () => {
    const currentRows = ids.map((id, index) => index < 3 ? { ...row(id), acceptedEvidence: [] } : row(id));
    const value = build(currentRows);
    expect(value.metrics.acceptedEvidenceMissed.delta).toBe(-55);
    expect(value.recoveredEventIds.acceptedEvidenceMissed).toHaveLength(55);
    expect(value.regressedEventIds.acceptedEvidenceMissed).toHaveLength(0);
    expect(value.metrics.acceptedEvidenceMissed.frozenRc2 - value.metrics.acceptedEvidenceMissed.current).toBe(value.recoveredEventIds.acceptedEvidenceMissed.length - value.regressedEventIds.acceptedEvidenceMissed.length);
  });

  it("serializes equivalent comparisons byte-identically and protects the frozen baseline", () => {
    const first = build();
    const second = build();
    expect(serializeVm0007Rc3CurrentComparison(first)).toBe(serializeVm0007Rc3CurrentComparison(second));
    expect(first.frozenRc2Baseline.sha256).toBe("15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf");
    expect(first.fixtureProtection).toEqual({ reviewedTruthUnchanged: true, frozenProposalUnchanged: true, frozenRc2Unchanged: true });
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json")).toString()).digest("hex")).toBe("b53fc19a8316f88896b7f9564a8e2d2d0dd8b08c9e05868a7b427140f47e1127");
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/machine-proposal.json")).toString()).digest("hex")).toBe("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
  });

  it("validates the committed artifact shape and all 58 rules", () => {
    const value = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    expect(value.ruleCount).toBe(58);
    expect(value.currentProposalSource.kind).toBe("same_run_serialized_reload");
    expect(value.frozenRc2Baseline.sha256).toBe("15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf");
    expect(Object.fromEntries(Object.entries(value.metrics).map(([key, metric]: [string, any]) => [key, metric.current]))).toEqual({
      acceptedEvidenceMissed: 95,
      acceptedEvidenceFalseSupport: 174,
      evidenceStateFailures: 39,
      applicabilityFailures: 6,
      reviewerOutcomeFailures: 58,
      contradictionFailures: 58,
      clientActionFailures: 58,
      draftFindingFailures: 58,
    });
    expect(value.currentAcceptedEvidenceMissTaxonomy.categoryCounts).toEqual({ never_retrieved: 13, retrieved_but_filtered: 35, ranked_below_cutoff: 0, selected_but_match_failed: 47, unresolved_insufficient_trace: 0 });
    expect(value.regressedEventIds.acceptedEvidenceFalseSupport).toHaveLength(116);
    expect(value.metrics.acceptedEvidenceFalseSupport.delta).toBe(value.regressedEventIds.acceptedEvidenceFalseSupport.length - value.recoveredEventIds.acceptedEvidenceFalseSupport.length);
  });
});
