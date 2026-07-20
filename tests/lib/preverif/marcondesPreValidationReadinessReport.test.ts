import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const sha = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");

describe("Marcondes pre-validation readiness report", () => {
  it("renders all frozen Evidence Map rows and release-layer sections", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    expect(report.title).toBe("Marcondes VM0007 v1.8 Pre-Validation Readiness Report");
    expect(report.rules).toHaveLength(58);
    expect(report.executiveSummary.evidenceStateCounts).toEqual({ FOUND: 6, UNCLEAR: 21, MISSING: 9, "N/A": 22 });
    expect(report.executiveSummary.reviewerOutcomeCounts).toEqual({ CONFORMS: 6, ACTION_REQUIRED: 30, NOT_APPLICABLE: 22, NOT_ASSESSED: 0 });
    expect(report.methodologyReview.classification).toBe("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect(report.methodologyReview.page61Reference).toBe("VM0007 v1.7");
    expect(report.methodologyReview.declarations).toContain("Tables 30 and 31");
    expect(report.releaseStatus).toBe("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(report.limitations.join(" ")).toMatch(/not validation.*verification.*certification/i);
    expect(report.rules.every((row) => row.acceptedEvidence && row.rejectedEvidence && row.rationale)).toBe(true);
  });

  it("does not modify frozen truth artifacts", () => {
    expect(sha("gold.json")).toBe("ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511");
    expect(sha("metadata.json")).toBe("e6db518b70297bb0647cb39ea837387b0193833a39fdc8270d8c186342101b83");
    expect(sha("release-status.json")).toBe("514af87d4096c684e0df118d30b6dd6f942af1434863eba14acf73ae0cfb1c19");
    expect(sha("methodology-reconciliation.md")).toBe("c0a8e51c7dbd0ce72597193745670829e44edbbb29fe85c1e6b845c44b1059cd");
    expect(sha("release-candidate-v1.0-rc1.json")).toBe("7e6cc77ae40759cbabee21f3094e6896e783d7294a80ab85a874ab49799ef0f8");
  });
});
