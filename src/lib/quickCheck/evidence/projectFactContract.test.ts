import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";
import { compileEvidenceDocument } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { buildProjectFactContract } from "@/lib/quickCheck/evidence/buildProjectFactContract";

function fixture(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check", name), "utf8");
}

function contractFor(name: string) {
  return buildProjectFactContract(compileEvidenceDocument({
    docId: name,
    rawText: fixture(name),
  }));
}

describe("buildProjectFactContract", () => {
  test("builds canonical scalar facts with provenance and rule names", () => {
    const contract = contractFor("cdm-energy-pdd-extracted.txt");

    expect(contract.projectTitle).toEqual(expect.objectContaining({
      value: "Nyota Small Hydro Project",
      page: 1,
      extractionRule: expect.any(String),
      evidenceSpanIds: expect.any(Array),
    }));
    expect(contract.hostCountry).toEqual(expect.objectContaining({
      value: "Uganda",
      extractionRule: expect.any(String),
    }));
    expect(contract.projectStandard).toEqual(expect.objectContaining({ value: "CDM" }));
    expect(contract.documentType).toEqual(expect.objectContaining({ value: "Project Design Document" }));
    expect(contract.methodologyPrimary).toEqual(expect.objectContaining({ value: "ACM0002 Version 20.0" }));
    expect(contract.projectType).toEqual(expect.objectContaining({ value: "Energy" }));
    expect(contract.creditingPeriod).toBeNull();
  });

  test("keeps methodology separate from project title in VCS or Verra and REDD documents", () => {
    const verra = contractFor("verra-project-facts-extracted.txt");
    const redd = contractFor("pd_redd_v1_130-extracted.txt");

    expect(verra.projectTitle?.value).toBe("Madre de Dios Forest Conservation Project");
    expect(verra.methodologyPrimary?.value).toContain("VM0007");
    expect(verra.projectTitle?.value).not.toContain("VM0007");

    expect(redd.projectTitle).toBeNull();
    expect(redd.methodologyPrimary?.value).toContain("VM0007");
  });

  test("builds section collections for baseline, monitoring, leakage, and additionality", () => {
    const contract = contractFor("verra-project-facts-extracted.txt");

    expect(contract.baselineSections[0]).toEqual(expect.objectContaining({
      value: expect.stringContaining("Baseline"),
      extractionRule: "section_heading.baseline",
      evidenceSpanIds: expect.any(Array),
    }));
    expect(contract.monitoringSections[0]).toEqual(expect.objectContaining({
      value: expect.stringContaining("Monitoring"),
    }));
    expect(contract.leakageSections[0]).toEqual(expect.objectContaining({
      value: expect.stringContaining("Leakage"),
    }));
    expect(contract.additionalitySections[0]).toEqual(expect.objectContaining({
      value: expect.stringContaining("Additionality"),
    }));
  });
});
