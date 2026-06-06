import { describe, expect, test } from "@jest/globals";
import { compileFixture, expectContractProvenance } from "./projectFactContractFixtureTestUtils";

describe("ProjectFactContract real fixtures", () => {
  test("keeps a CDM PDD excerpt grounded through title, country, methodology, and section facts", () => {
    const { evidence, contract } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/bsp-nepal-activity3-cdm-excerpt.txt",
      docId: "real-cdm",
    });

    expect(contract.documentFamily).toBe("CDM_PDD");
    expect(contract.projectTitle.value).toBe("Biogas Support Program - Nepal Activity-3");
    expect(contract.hostCountry.value).toBe("Nepal");
    expect(contract.projectCountry.value).toBe("Nepal");
    expect(contract.methodologyPrimary.value).toContain("AMS-I.E.");
    expect(contract.creditingPeriod.value).toBe("13 Dec 2011 - 12 Dec 2018");
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toEqual(["Baseline scenario"]);
    expect(contract.monitoringSections.value).toEqual(["Monitoring methodology and plan"]);
    expect(contract.leakageSections.value).toEqual(["Leakage"]);
    expect(contract.additionalitySections.value).toEqual(["Demonstration of additionality"]);
    expect(contract.warnings).not.toContainEqual(expect.stringContaining("Conflicting values detected"));

    expectContractProvenance(evidence, contract);
  });

  test("keeps a Verra/VCS project description grounded while leaving missing country facts unclear", () => {
    const { evidence, contract } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/plum-pdd-regression.txt",
      docId: "real-plum",
    });

    expect(contract.documentFamily).toBe("VERRA_PD");
    expect(contract.projectTitle.value).toBe("PLUM Project");
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBe("VM0007");
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toEqual(["Without-project Land Use Scenario and Additionality"]);
    expect(contract.monitoringSections.value).toEqual(["Monitoring", "Monitoring Plan"]);
    expect(contract.leakageSections.value).toBeNull();
    expect(contract.additionalitySections.value).toEqual(["Without-project Land Use Scenario and Additionality"]);
    expect(contract.warnings).toContain("Project country was not deterministically derivable.");
    expect(contract.warnings).toContain("Methodology inferred from a top-of-document code reference because no explicit methodology label was found.");

    expectContractProvenance(evidence, contract);
  });

  test("keeps a REDD/AFOLU project description grounded through title, methodology, and section facts", () => {
    const { evidence, contract } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/pd_redd_v1_130-extracted.txt",
      docId: "real-pd-redd",
    });

    expect(contract.documentFamily).toBe("REDD_AFOLU");
    expect(contract.projectTitle.value).toBe("Project Description Document: PD_REDD_v1_130");
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBe("VM0007 REDD+ Methodology Modules");
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toEqual(["(Baseline Scenario)"]);
    expect(contract.monitoringSections.value).toEqual(["Monitoring"]);
    expect(contract.leakageSections.value).toEqual(["(Leakage)"]);
    expect(contract.additionalitySections.value).toEqual(["(Additionality)"]);
    expect(contract.warnings).toContain("Project country was not deterministically derivable.");
    expect(contract.warnings).toContain("Methodology inferred from a top-of-document code reference because no explicit methodology label was found.");

    expectContractProvenance(evidence, contract);
  });

  test("keeps a table-heavy appendix conservative and surfaces quality and conflict warnings", () => {
    const { evidence, contract, qualityReport, qualityWarnings } = compileFixture({
      fixturePath: "tests/fixtures/projects/ccb1530-appendix1-pages.json",
      docId: "real-ccb1530",
      kind: "json-pages",
    });

    expect(contract.documentFamily).toBe("REDD_AFOLU");
    expect(contract.projectTitle.value).toBeNull();
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBeNull();
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toBeNull();
    expect(contract.monitoringSections.value).toBeNull();
    expect(contract.leakageSections.value).toBeNull();
    expect(contract.additionalitySections.value).toBeNull();
    expect(contract.warnings).toContainEqual(expect.stringContaining("Conflicting values detected"));
    expect(qualityReport.pageCount).toBeGreaterThan(1);
    expect(qualityReport.headersFootersDetected).toBe(true);
    expect(qualityReport.tableHeavyWarning).toBe(true);
    expect(qualityWarnings).toContain("Repeated headers or footers detected across pages.");
    expect(qualityWarnings).toContain("Document appears table-heavy; extraction may need table-aware handling.");

    expectContractProvenance(evidence, contract);
  });
});
