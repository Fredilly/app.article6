import { describe, expect, it } from "@jest/globals";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  EVIDENCE_AUDIT_STATUSES,
  hasLocalRuleAlignment,
  type MethodologyEvidenceAuditResult,
} from "@/lib/preverif/evidenceAudit";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import {
  getVm0007EvidenceContract,
  normalizeVm0007RuleId,
} from "@/lib/preverif/vm0007EvidenceContracts";
import {
  readQuickCheckFixtureText,
  VM0007_SYNCED_RULES,
} from "./preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");
const ENVIRA_V18_TEXT = ENVIRA_TEXT.replace("VM0007 Version 4.2", "REDD-MF / VM0007 v1.8");

function auditText(rawText: string) {
  const context = getStructuredQueryContext(rawText);
  return auditEvidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument: context.evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText,
  });
}

function byRuleId(results: MethodologyEvidenceAuditResult[], ruleId: string): MethodologyEvidenceAuditResult {
  const result = results.find((entry) => entry.ruleId === ruleId);
  if (!result) throw new Error(`Missing audit result for ${ruleId}`);
  return result;
}

function span(page: number, id: string, text: string): EvidenceSpan {
  return {
    spanId: id,
    docId: "synthetic-pdd",
    page,
    sectionId: `section-${page}`,
    heading: "Project evidence",
    headingPath: ["Project evidence"],
    sectionPath: ["Project evidence"],
    blockType: "paragraph",
    text,
    normalizedText: text.toLowerCase(),
    charStart: null,
    charEnd: null,
    reliability: "primary",
    confidence: 1,
  };
}

function auditSynthetic(
  ruleId: string,
  spans: EvidenceSpan[],
  diagnosticTrace = false,
  sections?: Array<{
    id: string;
    sectionNumber?: string;
    titleRaw: string;
    titleClean: string;
    bodyRaw: string;
    bodyClean: string;
  }>,
) {
  const rule = VM0007_SYNCED_RULES.find((candidate) => normalizeVm0007RuleId(candidate.id) === ruleId);
  if (!rule) throw new Error(`Missing synced rule ${ruleId}`);
  const evidenceDocument: EvidenceDocument = { docId: "synthetic-pdd", rawText: spans.map((candidate) => candidate.text).join("\n"), spans };
  return auditEvidence({
    rules: [rule],
    evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
    diagnosticTrace,
    sections,
  });
}

describe("auditEvidence with VM0007 contracts", () => {
  it("produces audit results for all 58 synced VM0007 rules and totals add up", () => {
    const audit = auditText(ENVIRA_V18_TEXT);
    const totalFromBuckets = Object.values(audit.totals).reduce((sum, count) => sum + count, 0);

    expect(audit.results).toHaveLength(58);
    expect(audit.totalRules).toBe(58);
    expect(totalFromBuckets).toBe(58);
    for (const result of audit.results) {
      if (result.status === "supported_by_pdd") {
        expect(result.evidence?.length ?? 0).toBeGreaterThan(0);
        expect(result.bestEvidenceQuote).toBe(result.evidence?.[0]?.quote);
      }
    }
  });

  it("uses only allowed statuses", () => {
    const audit = auditText(ENVIRA_V18_TEXT);

    for (const result of audit.results) {
      expect(EVIDENCE_AUDIT_STATUSES).toContain(result.status);
    }
  });

  it("includes client action on weak or missing outcomes", () => {
    const audit = auditText(ENVIRA_V18_TEXT);
    const weakResults = audit.results.filter((result) =>
      result.status === "partially_supported"
      || result.status === "missing_evidence"
      || result.status === "manual_review_needed",
    );

    expect(weakResults.length).toBeGreaterThan(0);
    for (const result of weakResults) {
      expect(result.clientAction.trim().length).toBeGreaterThan(0);
    }
  });

  it("requires actual PDD support before marking wetland-family rules not applicable", () => {
    const noNaSupport = auditText(`
      REDD-MF / VM0007 v1.8
      Project Description Document
      3.3 Leakage
      Leakage is discussed for nearby communities, but the PDD does not say whether the project is peatland, tidal wetland, or upland REDD only.
    `);
    const explicitNaSupport = auditText(`
      REDD-MF / VM0007 v1.8
      Project Description Document
      1.1 Project Activity
      This is a REDD/APD project in upland forest landscapes.
      1.2 Soils and Hydrology
      No peat soils or organic soils occur in the project area and the project is not a tidal wetland activity.
      1.3 Scope Exclusions
      The project is not ARR and not IFM. Soil carbon is excluded from the project boundary.
    `);

    expect(byRuleId(noNaSupport.results, "R-1-0010").status).toBe("manual_review_needed");
    expect(byRuleId(explicitNaSupport.results, "R-1-0010").status).toBe("not_applicable");
    expect(byRuleId(explicitNaSupport.results, "R-1-0011").status).toBe("not_applicable");
    expect(byRuleId(explicitNaSupport.results, "R-2-0009").status).toBe("not_applicable");
  });

  it("never uses passed-style outcome wording", () => {
    const audit = auditText(ENVIRA_V18_TEXT);
    expect(JSON.stringify(audit)).not.toMatch(/\bpassed\b/i);
  });

  it("does not treat VM0007 boilerplate or copied rule text as supported_by_pdd", () => {
    const audit = auditText(`
      REDD-MF / VM0007 v1.8
      Project Description Document

      2.4 Baseline Scenario
      The baseline scenario is the most likely land-use scenario in the absence of the project activity.
      VT0001 is mandatory. Alternative scenarios shall be listed and the most plausible baseline shall be selected.

      2.5 Additionality
      VT0001 additionality is required for all non-tidal-wetland activities.
      The project is additional because it faces barriers to implementation.

      3.3 Leakage
      There are three leakage components. Activity shifting leakage and market leakage shall be assessed.

      4.3 Monitoring Plan
      Four mandatory monitoring tasks are required. Monitoring plan content requirements include data, methods, frequency, QA/QC, archiving, and responsibilities.
    `);

    for (const ruleId of ["R-3-0001", "R-4-0001", "R-5-0003", "R-6-0001", "R-6-0002"]) {
      expect(byRuleId(audit.results, ruleId).status).not.toBe("supported_by_pdd");
    }
  });

  it("keeps the complete selected source quote without promoting a weak secondary span", () => {
    const first = "The project area qualifies as forest under the applicable forest definition thresholds and has remained forested for more than 10 years prior to the project start date.";
    const second = "The land-use history and area-specific evidence confirm the forest qualification for the project area.";
    const result = byRuleId(auditSynthetic("R-1-0001", [span(12, "p12", first), span(13, "p13", second)]).results, "R-1-0001");

    expect(result.bestEvidenceQuote).not.toContain("…");
    expect(result.bestEvidenceQuote).toBe(first);
    expect(result.evidence?.map((item) => item.page)).toEqual([12]);
    expect(result.evidence?.map((item) => item.span)).toEqual(["p12"]);
  });

  it("preserves score ordering and first-encounter tie behavior for the best candidate", () => {
    const first = "The project area qualifies as forest under the applicable forest definition thresholds and has remained forested for more than 10 years prior to the project start date.";
    const equal = first;
    const result = byRuleId(auditSynthetic("R-1-0001", [
      span(20, "first-equal", first),
      span(21, "second-equal", equal),
    ]).results, "R-1-0001");

    expect(result.span).toBe("first-equal");
    expect(result.page).toBe(20);
  });

  it("prefers a concise project assertion over a long methodology-heavy span", () => {
    const methodology = "The methodology requires the project proponent to demonstrate applicability, select the relevant modules, follow the applicable tools and standards, and document all required conditions. ".repeat(10);
    const projectFact = "The project area is upland forest and the APDef category is applicable to the project activity.";
    const result = byRuleId(auditSynthetic("R-3-0005", [
      span(60, "methodology", methodology),
      span(63, "project-fact", projectFact),
    ]).results, "R-3-0005");

    expect(result.page).toBe(63);
    expect(result.evidence?.[0]?.quote).toBe(projectFact);
    expect(result.evidence?.[0]?.span).toBe("project-fact");
  });

  it("retains explicit exclusion evidence for scope-sensitive N/A retrieval", () => {
    const methodology = "The methodology includes peatland, tidal wetland, ARR, IFM, and WRC modules and describes their applicability conditions.";
    const exclusion = "The project is REDD/APD only; there are no peat soils or tidal wetlands in the project area, and soil carbon is excluded.";
    const result = byRuleId(auditSynthetic("R-1-0010", [
      span(62, "scope-exclusion", exclusion),
      span(63, "copied-modules", methodology),
    ]).results, "R-1-0010");

    expect(result.status).toBe("not_applicable");
    expect(result.page).toBe(62);
    expect(result.evidence?.[0]?.span).toBe("scope-exclusion");
  });

  it.each([
    ["R-1-0004", "All property owners have filed applications for conversion authorization with the authority; the permits will be issued later."],
    ["R-3-0001", "The alternative scenarios and the VT0001 decision path will be provided during the validation stage."],
  ])("does not promote planned or unissued evidence for %s", (ruleId, text) => {
    const result = byRuleId(auditSynthetic(ruleId, [span(1, "future", text)]).results, ruleId);
    expect(result.status).not.toBe("supported_by_pdd");
    expect(result.bestEvidenceQuote).toBeNull();
    expect(result.rejectedEvidence?.[0]?.quote).toBe(text);
    expect(result.rejectedEvidence?.[0]).not.toHaveProperty("supportedComponents");
    expect(result.rejectedEvidence?.[0]).not.toHaveProperty("missingComponents");
  });

  it("produces useful Envira-like outputs across the main VM0007 categories", () => {
    const audit = auditText(ENVIRA_V18_TEXT);

    const eligibility = byRuleId(audit.results, "R-1-0001");
    const baseline = byRuleId(audit.results, "R-3-0001");
    const leakage = byRuleId(audit.results, "R-5-0003");
    const monitoring = byRuleId(audit.results, "R-6-0001");
    const additionality = byRuleId(audit.results, "R-4-0001");

    expect(eligibility.assessmentReason.trim().length).toBeGreaterThan(0);
    expect(eligibility.clientAction.trim().length).toBeGreaterThan(0);

    expect(baseline.assessmentReason.trim().length).toBeGreaterThan(0);
    expect(baseline.clientAction.trim().length).toBeGreaterThan(0);

    expect(["partially_supported", "supported_by_pdd"]).toContain(leakage.status);
    expect(leakage.bestEvidenceQuote).toBe(leakage.evidence?.[0]?.quote);
    expect(leakage.evidence?.[0]?.evidenceType).toMatch(/project_specific/);

    expect(["partially_supported", "supported_by_pdd"]).toContain(monitoring.status);
    expect(monitoring.bestEvidenceQuote).toBe(monitoring.evidence?.[0]?.quote);
    expect(monitoring.evidence?.[0]?.evidenceType).toMatch(/project_specific/);

    expect(additionality.assessmentReason.trim().length).toBeGreaterThan(0);
    expect(additionality.clientAction.trim().length).toBeGreaterThan(0);
  });

  it("requires project-specific complementary evidence to align locally with the current rule", () => {
    const rule = VM0007_SYNCED_RULES.find((candidate) => normalizeVm0007RuleId(candidate.id) === "R-1-0001");
    if (!rule) throw new Error("Missing R-1-0001");
    const contract = getVm0007EvidenceContract(rule);

    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project area qualifies as forest under the applicable forest definition thresholds.",
    })).toBe(true);
    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project team measured rainfall and community income for the leakage assessment.",
    })).toBe(false);
    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project team measured unrelated biodiversity indicators. The forest definition is copied from the methodology.",
    })).toBe(false);
  });

  it("keeps aligned complementary evidence and rejects an unrelated selected span with provenance", () => {
    const methodology = "The baseline scenario is the most likely land-use scenario in the absence of the project activity. Alternative scenarios shall be listed and the most plausible baseline scenario shall be selected.";
    const aligned = "The alternative scenarios were assessed with the VT0001 decision path, and the most plausible baseline scenario was selected for the project activity.";
    const unrelated = "The project activity was implemented with community agreements and annual plots. The baseline scenario and alternative scenarios are copied from an unrelated methodology fragment.";
    const result = byRuleId(auditSynthetic("R-3-0001", [
      span(11, "methodology", methodology),
      span(12, "aligned", aligned),
      span(13, "unrelated", unrelated),
    ]).results, "R-3-0001");

    expect(result.evidence?.map((item) => item.span)).toContain("aligned");
    const rejected = result.rejectedEvidence?.find((item) => item.span === "unrelated");
    expect(rejected?.quote).toBe(unrelated);
    expect(rejected?.page).toBe(13);
    expect(rejected?.rejectionReason).toBe("The span contains project-specific content but is not sufficiently aligned with the current rule.");
  });

  it("does not change alignment when the same source span is evaluated against another rule", () => {
    const source = "The project area qualifies as forest under the applicable forest definition thresholds.";
    const forestRule = VM0007_SYNCED_RULES.find((candidate) => normalizeVm0007RuleId(candidate.id) === "R-1-0001");
    const leakageRule = VM0007_SYNCED_RULES.find((candidate) => normalizeVm0007RuleId(candidate.id) === "R-5-0003");
    if (!forestRule || !leakageRule) throw new Error("Missing regression rules");

    expect(hasLocalRuleAlignment({ rule: forestRule, contract: getVm0007EvidenceContract(forestRule), text: source })).toBe(true);
    expect(hasLocalRuleAlignment({ rule: leakageRule, contract: getVm0007EvidenceContract(leakageRule), text: source })).toBe(false);
  });

  it("applies cross-rule alignment through the full audit pipeline and preserves the best candidate", () => {
    const sharedSource = "The project activity documents the selected baseline module for planned deforestation (APD) in the project area. The project area covers 300 hectares; all 36 properties were measured, recorded, mapped, and confirmed in the project records.";
    const aligned = auditSynthetic("R-3-0005", [
      span(10, "baseline-best", "Deforestation category baseline. ".repeat(12)),
      span(63, "shared-source", sharedSource),
    ], true, [{ id: "section-10", sectionNumber: "S-5", titleRaw: "S-5 Quantification of Estimated GHG Emission Reductions and Removals", titleClean: "S-5 Quantification of Estimated GHG Emission Reductions and Removals", bodyRaw: "", bodyClean: "" }]);
    const unrelated = auditSynthetic("R-1-0001", [
      span(11, "forest-best", "Forest definition thresholds. ".repeat(12)),
      span(63, "shared-source", sharedSource),
    ], true, [{ id: "section-11", sectionNumber: "S-1", titleRaw: "Forest definition sections", titleClean: "Forest definition sections", bodyRaw: "", bodyClean: "" }]);
    const alignedResult = byRuleId(aligned.results, "R-3-0005");
    const unrelatedResult = byRuleId(unrelated.results, "R-1-0001");

    expect(aligned.diagnosticTrace?.[0]?.selectedCandidates[0]?.spanId).toBe("baseline-best");
    expect(alignedResult.evidence?.some((record) => record.span === "shared-source")).toBe(true);
    expect(unrelated.diagnosticTrace?.[0]?.selectedCandidates[0]?.spanId).toBe("forest-best");
    const rejected = unrelatedResult.rejectedEvidence?.find((record) => record.span === "shared-source");
    expect(rejected).toEqual(expect.objectContaining({
      quote: sharedSource,
      page: 63,
      section: "Project evidence",
      span: "shared-source",
      rejectionReason: "The span contains project-specific content but is not sufficiently aligned with the current rule.",
    }));
  });

  it.each([
    ["descriptive module", "The project describes module M for the project pathway."],
    ["descriptive tool", "The project defines tool T as the applicable tool."],
  ])("keeps a %s as rejected declaration evidence", (_label, text) => {
    const result = byRuleId(auditSynthetic("R-3-0005", [
      span(63, "declaration", text),
    ]).results, "R-3-0005");

    expect(result.evidence?.some((record) => record.span === "declaration")).toBe(false);
    expect(result.rejectedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quote: text,
        page: 63,
        section: "Project evidence",
        span: "declaration",
        evidenceType: "module_or_tool_declaration",
        rejectionReason: "A module or tool declaration shows pathway selection, not completed project implementation.",
      }),
    ]));
  });

  it.each([
    ["long descriptive module", "The project describes module M as the selected pathway for the activity and provides a general explanation of the module and its purpose within the methodology documentation."],
    ["long descriptive tool", "The project defines tool T as the applicable tool and includes a general description of the tool and its methodological purpose for the selected project pathway."],
  ])("rejects a %s without an independent project fact", (_label, text) => {
    const result = byRuleId(auditSynthetic("R-3-0005", [
      span(63, "long-declaration", text),
    ]).results, "R-3-0005");

    expect(result.evidence?.some((record) => record.span === "long-declaration")).toBe(false);
    expect(result.rejectedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quote: text,
        page: 63,
        section: "Project evidence",
        span: "long-declaration",
        evidenceType: "module_or_tool_declaration",
        rejectionReason: "A module or tool declaration shows pathway selection, not completed project implementation.",
      }),
    ]));
  });

  it("accepts descriptive implementation when the same span contains an independent project fact", () => {
    const text = "The project defines the selected baseline module for planned deforestation, and the project area covers 300 hectares across 36 properties.";
    const result = byRuleId(auditSynthetic("R-3-0005", [
      span(63, "factual-description", text),
    ]).results, "R-3-0005");

    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quote: text,
        page: 63,
        section: "Project evidence",
        span: "factual-description",
        evidenceType: "project_specific_implementation",
      }),
    ]));
    expect(result.rejectedEvidence?.some((record) => record.span === "factual-description")).toBe(false);
  });

  it("does not let a weak contract signal independently pass local alignment", () => {
    const rule = { id: "R-WEAK", title: "Water quality sampling", logic: "Project-specific sampling results" };
    const contract = {
      ...getVm0007EvidenceContract("R-5-0003"),
      label: "Water quality sampling",
      strongEvidenceSignals: ["Water quality results are tied to the project activity"],
      weakEvidenceSignals: ["Monitoring is described generally without task detail"],
    };

    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project monitoring is described generally without task detail.",
    })).toBe(false);
  });

  it("requires project facts and the rule subject in one fragment, while preserving the 58-rule surface", () => {
    const rule = VM0007_SYNCED_RULES.find((candidate) => normalizeVm0007RuleId(candidate.id) === "R-1-0001");
    if (!rule) throw new Error("Missing R-1-0001");
    const contract = getVm0007EvidenceContract(rule);

    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project area is described in the PDD. The forest definition appears in a copied methodology fragment.",
    })).toBe(false);
    expect(hasLocalRuleAlignment({
      rule,
      contract,
      text: "The project area qualifies as forest under the applicable forest definition thresholds.",
    })).toBe(true);
    expect(auditText(ENVIRA_V18_TEXT).results).toHaveLength(58);
  });
});
