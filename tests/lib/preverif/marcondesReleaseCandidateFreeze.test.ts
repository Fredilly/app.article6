import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
const freezeRecord = fs.readFileSync(path.join(process.cwd(), "docs/roadmaps/vm0007-evidence-map-mvp/marcondes-vm0007-v18-release-freeze-record.md"), "utf8");

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

  it("pins the final client deliverable freeze inventory and protected artifacts", () => {
    expect(freezeRecord).toContain("- Project: Marcondes VM0007 v1.8");
    expect(freezeRecord).toContain("- Deliverable: Pre-Validation Readiness Report");
    expect(freezeRecord).toContain("- Status: FROZEN");
    expect(freezeRecord).toMatch(/\| Total rules \| 58 \|/);
    expect(freezeRecord).toMatch(/\| FOUND \| 6 \|/);
    expect(freezeRecord).toMatch(/\| UNCLEAR \| 21 \|/);
    expect(freezeRecord).toMatch(/\| MISSING \| 9 \|/);
    expect(freezeRecord).toMatch(/\| N\/A \| 22 \|/);
    expect(freezeRecord).toMatch(/\| CONFORMS \| 6 \|/);
    expect(freezeRecord).toMatch(/\| ACTION_REQUIRED \| 30 \|/);
    expect(freezeRecord).toMatch(/\| NOT_APPLICABLE \| 22 \|/);
    expect(freezeRecord).toContain("ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511");
    expect(freezeRecord).toContain("e6db518b70297bb0647cb39ea837387b0193833a39fdc8270d8c186342101b83");
    expect(freezeRecord).toContain("514af87d4096c684e0df118d30b6dd6f942af1434863eba14acf73ae0cfb1c19");
    expect(freezeRecord).toContain("9e12d0f356cd68267ad9d2d28e7bd18e64cbedccdfad5df841763356476392c9");
    expect(freezeRecord).toContain("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
    expect(freezeRecord).toContain("6e61e9c04e19ef27d01d4bc668270e8776564a8b39f40ccf37f53b1529094473");
    expect(freezeRecord).toContain("All 58 of 58 appendix rows match.");
    expect(freezeRecord).toContain("Website and PDF consume the same presentation model.");
  });
});
