import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");

describe("Marcondes v1.0-rc1 internal release candidate", () => {
  const manifest = read("release-candidate-v1.0-rc1.json");

  it("pins every release artifact to its recorded SHA-256", () => {
    for (const [name, expected] of Object.entries(manifest.pinnedArtifacts)) expect(sha256(name)).toBe(expected);
  });

  it("records the audited source and exact reviewed totals", () => {
    expect(manifest.sourceCommit).toBe("9698d4f94ad8018ebc10a70b5571a486f0b10d57");
    expect(manifest.reviewedRules).toBe(58);
    expect(manifest.acceptedEvidenceEntries).toBe(97);
    expect(manifest.counts).toEqual({ FOUND: 6, UNCLEAR: 21, MISSING: 9, "N/A": 22 });
    expect(manifest.reviewerOutcomes).toEqual({ CONFORMS: 6, ACTION_REQUIRED: 30, NOT_APPLICABLE: 22, NOT_ASSESSED: 0 });
  });

  it("remains blocked and cannot be treated as a final client release", () => {
    expect(manifest.status).toBe("internal release candidate");
    expect(manifest.version).toBe("v1.0-rc1");
    expect(manifest.reportReleaseState).toBe("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(manifest.methodologyClassification).toBe("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect(manifest.status).not.toMatch(/final|approved|validated|verified|certified/i);
  });

  it("keeps truth artifacts and the release blocker intact", () => {
    const gold = read("gold.json");
    const releaseStatus = read("release-status.json");
    expect(gold.rows).toHaveLength(58);
    expect(gold.rows.reduce((n: number, row: any) => n + row.acceptedEvidence.length, 0)).toBe(97);
    expect(gold.counts).toEqual(manifest.counts);
    expect(releaseStatus.reportReleaseState).toBe("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(releaseStatus.goldPromotionBlocked).toBe(true);
    expect(releaseStatus.reportReleaseBlocker).toMatch(/page-61.*v1\.7.*Tables 30 and 31.*blocked/i);
  });
});
