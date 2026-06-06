import { describe, expect, test } from "@jest/globals";
import { compileFixture, expectContractProvenance } from "./projectFactContractFixtureTestUtils";

describe("ProjectFactContract more real fixtures", () => {
  test("keeps a noisier Verra/VCS project description conservative when title evidence conflicts", () => {
    const { evidence, contract } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/plum-pdd-extracted.txt",
      docId: "more-real-plum",
    });

    expect(contract.documentFamily).toBe("VERRA_PD");
    expect(contract.projectTitle.value).toBeNull();
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.projectProponent.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBe("VM0007");
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toBeNull();
    expect(contract.monitoringSections.value).toEqual(["Monitoring"]);
    expect(contract.leakageSections.value).toBeNull();
    expect(contract.additionalitySections.value).toBeNull();
    expect(contract.projectTitle.warnings).toContain("Conflicting values detected: PLUM Project | Section 3.3");
    expect(contract.warnings).toContain("Project country was not deterministically derivable.");
    expect(contract.warnings).toContain("Methodology inferred from a top-of-document code reference because no explicit methodology label was found.");

    expectContractProvenance(evidence, contract);
  });

  test("keeps a second REDD/AFOLU project document grounded while surfacing missing sections clearly", () => {
    const { evidence, contract } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/envira-amazonia-vm0007-extracted.txt",
      docId: "more-real-envira",
    });

    expect(contract.documentFamily).toBe("REDD_AFOLU");
    expect(contract.projectTitle.value).toBe("Envira Amazonia REDD+ Project");
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.projectProponent.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBe("VM0007 Version 4.2");
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toBeNull();
    expect(contract.monitoringSections.value).toEqual(["Monitoring Plan"]);
    expect(contract.leakageSections.value).toEqual(["Leakage"]);
    expect(contract.additionalitySections.value).toBeNull();
    expect(contract.warnings).toContain("Project country was not deterministically derivable.");
    expect(contract.warnings).toContain("Methodology inferred from a top-of-document code reference because no explicit methodology label was found.");
    expect(contract.warnings).toContain("No baseline sections were found.");
    expect(contract.warnings).toContain("No additionality sections were found.");

    expectContractProvenance(evidence, contract);
  });

  test("keeps a table-heavy appendix document conservative and preserves page-backed conflict provenance", () => {
    const { evidence, contract, qualityReport, qualityWarnings } = compileFixture({
      fixturePath: "tests/fixtures/projects/ccb1530-appendix1-pages.json",
      docId: "more-real-ccb1530",
      kind: "json-pages",
    });

    expect(contract.documentFamily).toBe("REDD_AFOLU");
    expect(contract.projectTitle.value).toBeNull();
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.projectProponent.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBeNull();
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toBeNull();
    expect(contract.monitoringSections.value).toBeNull();
    expect(contract.leakageSections.value).toBeNull();
    expect(contract.additionalitySections.value).toBeNull();
    expect(contract.projectTitle.evidenceSpanIds.length).toBeGreaterThan(1);
    expect(contract.projectTitle.pageNumbers).toEqual([1]);
    expect(contract.projectTitle.warnings).toContain("Conflicting values detected: or removals | Net GHG");
    expect(qualityReport.pageCount).toBeGreaterThan(1);
    expect(qualityReport.headersFootersDetected).toBe(true);
    expect(qualityReport.tableHeavyWarning).toBe(true);
    expect(qualityWarnings).toContain("Repeated headers or footers detected across pages.");
    expect(qualityWarnings).toContain("Document appears table-heavy; extraction may need table-aware handling.");

    expectContractProvenance(evidence, contract);
  });

  test("keeps a weak generic upload as UNKNOWN with only unclear facts", () => {
    const { evidence, contract, qualityReport } = compileFixture({
      fixturePath: "tests/fixtures/quick-check/weak-unknown-fallback.txt",
      docId: "more-real-weak",
    });

    expect(contract.documentFamily).toBe("UNKNOWN");
    expect(contract.projectTitle.value).toBeNull();
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.projectCountry.value).toBeNull();
    expect(contract.projectProponent.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBeNull();
    expect(contract.creditingPeriod.value).toBeNull();
    expect(contract.reportingPeriod.value).toBeNull();
    expect(contract.monitoringPeriod.value).toBeNull();
    expect(contract.baselineSections.value).toBeNull();
    expect(contract.monitoringSections.value).toBeNull();
    expect(contract.leakageSections.value).toBeNull();
    expect(contract.additionalitySections.value).toBeNull();
    expect(qualityReport.pageCount).toBe(1);
    expect(qualityReport.textDensity).toBeLessThan(0.2);
    expect(contract.projectTitle.warnings).toContain(
      "Conflicting values detected: Document upload | This file contains administrative notes and an appendix list. | No formal review sections are identified in the recovered text.",
    );
    expect(contract.warnings).toContain("Project country was not deterministically derivable.");
    expect(contract.warnings).toContain("Document family did not map to a deterministic project standard.");
    expect(contract.warnings).toContain("No monitoring sections were found.");

    expectContractProvenance(evidence, contract);
  });
});
