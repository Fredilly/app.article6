import { describe, expect, it } from "@jest/globals";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditVm0007Evidence,
  VM0007_AUDIT_STATUSES,
  type Vm0007EvidenceAuditResult,
} from "@/lib/preverif/vm0007EvidenceAudit";
import {
  readQuickCheckFixtureText,
  VM0007_SYNCED_RULES,
} from "./preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");

function auditText(rawText: string) {
  const context = getStructuredQueryContext(rawText);
  return auditVm0007Evidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument: context.evidenceDocument,
    sections: context.documentStructure.sections,
    rawText,
  });
}

function byRuleId(results: Vm0007EvidenceAuditResult[], ruleId: string): Vm0007EvidenceAuditResult {
  const result = results.find((entry) => entry.ruleId === ruleId);
  if (!result) throw new Error(`Missing audit result for ${ruleId}`);
  return result;
}

describe("auditVm0007Evidence", () => {
  it("produces audit results for all 58 synced VM0007 rules and totals add up", () => {
    const audit = auditText(ENVIRA_TEXT);
    const totalFromBuckets = Object.values(audit.totals).reduce((sum, count) => sum + count, 0);

    expect(audit.results).toHaveLength(58);
    expect(audit.totalRules).toBe(58);
    expect(totalFromBuckets).toBe(58);
  });

  it("uses only allowed statuses", () => {
    const audit = auditText(ENVIRA_TEXT);

    for (const result of audit.results) {
      expect(VM0007_AUDIT_STATUSES).toContain(result.status);
    }
  });

  it("includes client action on weak or missing outcomes", () => {
    const audit = auditText(ENVIRA_TEXT);
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
      VM0007 Version 4.2
      Project Description Document
      3.3 Leakage
      Leakage is discussed for nearby communities, but the PDD does not say whether the project is peatland, tidal wetland, or upland REDD only.
    `);
    const explicitNaSupport = auditText(`
      VM0007 Version 4.2
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
    const audit = auditText(ENVIRA_TEXT);
    expect(JSON.stringify(audit)).not.toMatch(/\bpassed\b/i);
  });

  it("does not treat VM0007 boilerplate or copied rule text as supported_by_pdd", () => {
    const audit = auditText(`
      VM0007 Version 4.2
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

  it("produces useful Envira-like outputs across the main VM0007 categories", () => {
    const audit = auditText(ENVIRA_TEXT);

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
    expect(leakage.bestEvidenceQuote?.toLowerCase()).toContain("activity shifting leakage");

    expect(["partially_supported", "supported_by_pdd"]).toContain(monitoring.status);
    expect(monitoring.bestEvidenceQuote?.toLowerCase()).toContain("monitoring plan");

    expect(additionality.assessmentReason.trim().length).toBeGreaterThan(0);
    expect(additionality.clientAction.trim().length).toBeGreaterThan(0);
  });
});
