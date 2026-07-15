import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { buildVm0007Rc3FalseSupportTaxonomy, serializeVm0007Rc3FalseSupportTaxonomy } from "@/lib/preverif/vm0007Rc3FalseSupportTaxonomy";

const root = process.cwd();
const artifactPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC3_FALSE_SUPPORT_TAXONOMY.json");
const comparisonPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC3_CURRENT_COMPARISON.json");
const goldPath = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json");
const machinePath = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/machine-proposal.json");
const baselinePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC2_BASELINE.json");
const ids = Array.from({ length: 58 }, (_, index) => `rule-${String(index + 1).padStart(2, "0")}`);
const provenance = (spanId: string) => ({ docId: "doc", page: 1, sectionPath: ["S"], spanId, sectionHeading: "S", sourceType: "PDD" });
const evidence = (quote: string, spanId: string, evidenceType?: string) => ({ quote, provenance: provenance(spanId), ...(evidenceType ? { evidenceType } : {}) });

function synthetic(rows: readonly any[], reviewed = ids.map((ruleId) => ({ ruleId, acceptedEvidence: [], rejectedEvidence: [] }))) {
  const completeReviewed = reviewed.map((row) => ({ finalEvidenceState: "MISSING", applicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE_IDENTIFIED", draftFindingCandidate: null, clientAction: "retain", ...row }));
  const completeRows = rows.map((row, index) => ({ stableRuleId: ids[index], upstreamStatus: "FOUND", proposedApplicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE_IDENTIFIED", draftFindingCandidate: null, clientAction: "retain", acceptedEvidence: [], rejectedEvidence: [], ...row }));
  const audit = {
    results: ids.map((stableId, index) => ({ stableId, evidence: completeRows[index].acceptedEvidence, rejectedEvidence: [], span: completeRows[index].acceptedEvidence[0]?.provenance?.spanId ?? null, bestEvidenceQuote: completeRows[index].acceptedEvidence[0]?.quote ?? null })),
    diagnosticTrace: ids.map((stableId, index) => ({ stableId, retrievalCandidates: completeRows[index].acceptedEvidence.map((item: any) => ({ spanId: item.provenance.spanId, quote: item.quote, page: 1, score: 20, evidenceType: item.evidenceType ?? "project_specific_implementation", rejectionReason: null })), postFilterCandidates: [], selectedCandidates: completeRows[index].acceptedEvidence.map((item: any) => ({ spanId: item.provenance.spanId, quote: item.quote, page: 1, score: 20, evidenceType: item.evidenceType ?? "project_specific_implementation", rejectionReason: null })), cutoffPosition: 6 })),
  };
  const draftRows = ids.map((stableRuleId, index) => ({ stableRuleId, acceptedEvidence: completeRows[index].acceptedEvidence, rejectedEvidence: [], proposedAcceptedEvidence: completeRows[index].acceptedEvidence[0] ?? null, proposedRejectedEvidence: null, quote: completeRows[index].acceptedEvidence[0]?.quote ?? null, spanId: completeRows[index].acceptedEvidence[0]?.provenance?.spanId ?? null, provenance: completeRows[index].acceptedEvidence[0]?.provenance ?? null }));
  const packageValue = { rows: draftRows } as any;
  return buildVm0007Rc3FalseSupportTaxonomy({ currentRows: completeRows as any, reviewedRows: completeReviewed as any, expectedStableRuleIds: ids, audit: audit as any, draft: packageValue, reloadedDraft: JSON.parse(JSON.stringify(packageValue)) });
}

describe("RC3-5 false-support taxonomy", () => {
  it("classifies all current false-support events exactly once and preserves canonical IDs", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const comparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));
    expect(artifact.totalEvents).toBe(174);
    expect(artifact.events).toHaveLength(174);
    expect(new Set(artifact.events.map((event: any) => event.eventId)).size).toBe(174);
    expect(artifact.events.map((event: any) => event.eventId).sort()).toEqual(comparison.regressedEventIds.acceptedEvidenceFalseSupport.slice().sort());
    expect(Object.values(artifact.primarySubtypeCounts).reduce((sum: number, count: any) => sum + count, 0)).toBe(174);
  });

  it("applies deterministic precedence for broad, fragment, cross-rule and duplicate evidence", () => {
    const rows = ids.map(() => ({ acceptedEvidence: [] }));
    const reviewed = ids.map((ruleId) => ({ ruleId, acceptedEvidence: [], rejectedEvidence: [] }));
    reviewed[0].acceptedEvidence = [evidence("alpha beta", "reviewed-0")];
    reviewed[1].acceptedEvidence = [evidence("alpha beta", "reviewed-1")];
    reviewed[5].acceptedEvidence = [evidence("cross rule quote", "reviewed-5")];
    rows[0].acceptedEvidence = [evidence("alpha beta extra", "broad")];
    rows[1].acceptedEvidence = [evidence("alpha", "fragment")];
    rows[2].acceptedEvidence = [evidence("cross rule quote", "cross")];
    rows[3].acceptedEvidence = [evidence("duplicate", "duplicate")];
    rows[4].acceptedEvidence = [evidence("duplicate", "duplicate")];
    const value = synthetic(rows, reviewed);
    const byRule = new Map(value.events.map((event) => [event.stableRuleId, event]));
    expect(byRule.get(ids[0])?.primarySubtype).toBe("broad_span_contains_reviewed_quote_same_rule");
    expect(byRule.get(ids[1])?.primarySubtype).toBe("machine_fragment_of_reviewed_quote_same_rule");
    expect(byRule.get(ids[2])?.primarySubtype).toBe("quote_reviewed_under_different_rule");
    expect(byRule.get(ids[3])?.primarySubtype).toBe("duplicated_across_multiple_rules");
    expect(byRule.get(ids[4])?.primarySubtype).toBe("duplicated_across_multiple_rules");
    expect(byRule.get(ids[0])?.secondaryFlags.broadSpanMatch).toBe(true);
    expect(byRule.get(ids[1])?.secondaryFlags.fragmentMatch).toBe(true);
    expect(byRule.get(ids[2])?.secondaryFlags.crossRuleMatch).toBe(true);
    expect(byRule.get(ids[3])?.secondaryFlags.reusedAcrossRules).toBe(true);
  });

  it("classifies evidence-type subtypes and proves downstream preservation", () => {
    const rows = ids.map(() => ({ acceptedEvidence: [] }));
    rows[0].acceptedEvidence = [evidence("methodology", "type-0", "methodology_boilerplate")];
    rows[1].acceptedEvidence = [evidence("module", "type-1", "module_or_tool_declaration")];
    rows[2].acceptedEvidence = [evidence("noise", "type-2", "incomplete_or_noisy")];
    rows[3].acceptedEvidence = [evidence("project scope", "type-3", "project_specific_scope")];
    rows[4].acceptedEvidence = [evidence("project implementation", "type-4", "project_specific_implementation")];
    const value = synthetic(rows);
    expect(value.primarySubtypeCounts.accepted_methodology_boilerplate).toBe(1);
    expect(value.primarySubtypeCounts.accepted_module_or_tool_declaration).toBe(1);
    expect(value.primarySubtypeCounts.accepted_incomplete_or_noisy).toBe(1);
    expect(value.primarySubtypeCounts.accepted_project_specific_but_unmatched).toBe(2);
    expect(value.auditAcceptance).toEqual({ acceptedInAuditResult: 5, draftPreserved: 5, serializedPreserved: 5, draftInvented: 0, serializationInvented: 0 });
  });

  it("serializes independently built equivalent taxonomy values byte-identically", () => {
    const rows = ids.map(() => ({ acceptedEvidence: [] }));
    rows[0].acceptedEvidence = [evidence("same", "same")];
    const first = synthetic(rows);
    const second = synthetic(JSON.parse(JSON.stringify(rows)));
    expect(serializeVm0007Rc3FalseSupportTaxonomy(first)).toBe(serializeVm0007Rc3FalseSupportTaxonomy(second));
    expect(canonicalJsonStringify(first)).toBe(canonicalJsonStringify(second));
  });

  it("protects reviewed truth, machine proposal and RC2 baseline", () => {
    expect(crypto.createHash("sha256").update(fs.readFileSync(goldPath)).digest("hex")).toBe("b53fc19a8316f88896b7f9564a8e2d2d0dd8b08c9e05868a7b427140f47e1127");
    expect(crypto.createHash("sha256").update(fs.readFileSync(machinePath)).digest("hex")).toBe("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
    expect(crypto.createHash("sha256").update(fs.readFileSync(baselinePath)).digest("hex")).toBe("15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf");
  });
});
