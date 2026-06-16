import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import {
  classifyQuickCheckDocument,
  quickCheckDocumentClassLabel,
  type QuickCheckDocumentClass,
} from "@/lib/documentClassification";

type ClassificationFixture = {
  fileName: string;
  fixturePath: string;
  expectedClass: QuickCheckDocumentClass;
};

const FIXTURES: ClassificationFixture[] = [
  {
    fileName: "VALID_REP_1530_31MAY2016.pdf",
    fixturePath: "tests/fixtures/quick-check/vichada-validation-report-extracted.txt",
    expectedClass: "validation_report",
  },
  {
    fileName: "VERRA-Verification-Report_2016-2021.pdf",
    fixturePath: "tests/fixtures/quick-check/generation-forest-verification-extracted.txt",
    expectedClass: "verification_report",
  },
  {
    fileName: "PLUM a.pdf",
    fixturePath: "tests/fixtures/quick-check/a-pdf-extracted.txt",
    expectedClass: "project_description_pdd",
  },
  {
    fileName: "PD_REDD_v1_130.pdf",
    fixturePath: "tests/fixtures/quick-check/pd_redd_v1_130-extracted.txt",
    expectedClass: "project_description_pdd",
  },
  {
    fileName: "PROJ_DESC_1382_04APR2015.pdf",
    fixturePath: "tests/fixtures/quick-check/proj-desc-1382-extracted.txt",
    expectedClass: "project_description_pdd",
  },
];

describe("quick check document classification", () => {
  for (const fixture of FIXTURES) {
    it(`classifies ${fixture.fileName} as ${fixture.expectedClass}`, () => {
      const rawText = fs.readFileSync(path.join(process.cwd(), fixture.fixturePath), "utf-8");
      const result = classifyQuickCheckDocument({
        fileName: fixture.fileName,
        mime: "application/pdf",
        rawText,
      });

      expect(result.documentClass).toBe(fixture.expectedClass);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.secondaryCandidates.length).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0.45);
      expect(quickCheckDocumentClassLabel(result.documentClass)).toBeTruthy();
    });
  }

  it("returns provenance-backed secondary candidates", () => {
    const rawText = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/quick-check/generation-forest-verification-extracted.txt"),
      "utf-8",
    );
    const result = classifyQuickCheckDocument({
      fileName: "VERRA-Verification-Report_2016-2021.pdf",
      mime: "application/pdf",
      rawText,
    });

    expect(result.documentClass).toBe("verification_report");
    expect(result.evidence.some((item) => /filename|page 1 header|repeated header/i.test(item))).toBe(true);
    expect(result.secondaryCandidates.every((candidate) => candidate.documentClass !== result.documentClass)).toBe(true);
    expect(result.secondaryCandidates.every((candidate) => Array.isArray(candidate.evidence))).toBe(true);
  });
});
