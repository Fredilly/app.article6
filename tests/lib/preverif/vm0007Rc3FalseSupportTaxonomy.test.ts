import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { assertAuditedV2Identities, AUDITED_V2_IDENTITIES, buildVm0007Rc3FalseSupportTaxonomy, serializeVm0007Rc3FalseSupportTaxonomy } from "@/lib/preverif/vm0007Rc3FalseSupportTaxonomy";

const root = process.cwd();
const artifactPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3/RC3_FALSE_SUPPORT_TAXONOMY.json");
const comparisonPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3/RC3_AUDITED_CURRENT_COMPARISON.json");
const goldPath = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json");
const machinePath = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/machine-proposal.json");
const baselinePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2/RC2_BASELINE.json");
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
    const auditedComparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));
    const auditedFalseSupportCount = auditedComparison.metrics.acceptedEvidenceFalseSupport.current;
    expect(artifact.totalEvents).toBe(auditedFalseSupportCount);
    expect(artifact.events).toHaveLength(auditedFalseSupportCount);
    expect(new Set(artifact.events.map((event: any) => event.eventId)).size).toBe(auditedFalseSupportCount);
    expect(artifact.events.map((event: any) => event.eventId).sort()).toEqual(auditedComparison.regressedEventIds.acceptedEvidenceFalseSupport.slice().sort());
    expect(Object.values(artifact.primarySubtypeCounts).reduce((sum: number, count: any) => sum + count, 0)).toBe(auditedFalseSupportCount);
    expect(artifact.primarySubtypeCounts).toMatchObject({
      quote_reviewed_under_different_rule: 109,
      broad_span_contains_reviewed_quote_same_rule: 34,
      duplicated_across_multiple_rules: 29,
      accepted_project_specific_but_unmatched: 2,
    });
    expect(artifact.schemaVersion).toBe("vm0007-rc3-false-support-taxonomy-v2");
    expect(artifact.traceVersion).toBe("rc3-audited-v2-false-support-taxonomy-v1");
    expect(artifact.source).toMatchObject({
      reviewedTruthSha256: AUDITED_V2_IDENTITIES.reviewedTruthSha256,
      sourceExtractionSha256: AUDITED_V2_IDENTITIES.sourceExtractionSha256,
      auditExecutionSha256: AUDITED_V2_IDENTITIES.productionExecutionSha256,
      generatedProposalSha256: AUDITED_V2_IDENTITIES.generatedProposalSha256,
      frozenRc2BaselineSha256: "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf",
      auditedV2BaselineSha256: AUDITED_V2_IDENTITIES.auditedBaselineSha256,
    });
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
    expect(crypto.createHash("sha256").update(fs.readFileSync(goldPath)).digest("hex")).toBe(AUDITED_V2_IDENTITIES.reviewedTruthSha256);
    expect(crypto.createHash("sha256").update(fs.readFileSync(machinePath)).digest("hex")).toBe("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
    expect(crypto.createHash("sha256").update(fs.readFileSync(baselinePath)).digest("hex")).toBe("15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf");
    const frozen = {
      "RC2_BASELINE.md": "e8d1bc1d7172865f9709d31588887d8906b8520b76f31d47df2b3ced70c4816b",
      "RC3_DIAGNOSTIC.json": "a4964f1f8aec6a11c35ec07e2fcc1a8e9a1d31e0661811b9cf70d4e77d32c737",
      "RC3_SELECTED_MATCH_SUBTAXONOMY.json": "583ca35f70c9c51a924f777d2a26062b83bb7b63d54380435f1dbdd3e45e5910",
      "RC3_SAME_RUN_HANDOFF_TRACE.json": "9e0959845029152506663e6c8ffb52051a17b4b8e8f69c983c84ea078acd2ab4",
      "RC3_CURRENT_COMPARISON.json": "3e10f733f9a0630f2540e736295fdeb77d829911550bc2366361736ff9cdc964",
      "RC3_AUDITED_PRE_FIX_BASELINE.json": "12c6276c12ba62d7f93987e3d4097d732ab05ded1432621a5895aa7527e5be87",
      "RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json": "5b41f5650ad975757f4376c8ec7ff29dd1eb6738310637cf2eddb2191c436f8f",
      "RC3_AUDITED_DIAGNOSTIC.json": "3dc8f4616eae03b1bfbc44e2a872f7177d56c06766c0524e22571573b6b298bd",
      "RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json": "e36325c78ea3e998e71b97adb1bb9f5a8e7c3e43fd1946c38003188e041da490",
      "RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json": "21bbd255153d524896517e48b58a6bb40425d9c37168605ab593c9ccf5a99c74",
      "RC3_AUDITED_CURRENT_COMPARISON.json": "f12754ca3e4c1eec6c9330139da46a3777276959c0b0dda569f6f93f023af329",
      "gold.rc2-rc3.json": "b53fc19a8316f88896b7f9564a8e2d2d0dd8b08c9e05868a7b427140f47e1127",
    };
    for (const [name, expected] of Object.entries(frozen)) {
      const file = name.startsWith("gold") ? path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map", name) : name.startsWith("RC2_BASELINE") ? path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2", name) : name.startsWith("RC3_AUDITED_PRE_FIX_BASELINE") || name.startsWith("RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST") ? path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc3", name) : path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3", name);
      expect(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")).toBe(expected);
    }
  });

  it("rejects historical or mismatched audited V2 identities", () => {
    expect(() => assertAuditedV2Identities({ ...AUDITED_V2_IDENTITIES, reviewedTruthSha256: "b53fc19a8316f88896b7f9564a8e2d2d0dd8b08c9e05868a7b427140f47e1127" })).toThrow("reviewedTruthSha256");
    expect(() => assertAuditedV2Identities({ ...AUDITED_V2_IDENTITIES, generatedProposalSha256: "27bb22ae48d11239cff66f79a016de9ce1d8fb069bcb87f5bf64a5ee6a080a57" })).toThrow("generatedProposalSha256");
    expect(() => assertAuditedV2Identities({ ...AUDITED_V2_IDENTITIES, productionExecutionSha256: "c35eb8957a068ca791bde8b0851a8f884b313309d6b30353719f60b946ba7c2b" })).toThrow("productionExecutionSha256");
  });
});
