import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as any;
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(fixtureDir, name))).digest("hex");
const shortId = (value: string) => value.split(".").pop()!;

describe("Marcondes final 58-rule release audit", () => {
  it("checks every reviewed row and records defects separately from the release blocker", () => {
    const audit = read("final-release-audit.json");
    const gold = read("gold.json");
    const independent = read("independent-audit.json");
    const ids = read("reviewedRuleIds.json").reviewedRuleIds.map(shortId);

    expect(audit.checkedRuleIds).toEqual(ids);
    expect(audit.summary).toEqual(expect.objectContaining({ reviewedRows: 58, checkedRows: 58, cleanRows: 48, defectRows: 10, blockedRows: 0, releaseBlockers: 1 }));
    expect(audit.summary.cleanRows + audit.summary.defectRows + audit.summary.blockedRows).toBe(audit.summary.checkedRows);
    expect(new Set(audit.summary.defectRuleIds)).toEqual(new Set(["R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005"]));
    expect(gold.rows).toHaveLength(58);
    expect(independent.rows).toHaveLength(58);
    expect(audit.defects).toHaveLength(1);
    expect(audit.defects[0].correctionStatus).toBe("BLOCKED_PENDING_PROTECTED_TRUTH_UPDATE");
    expect(audit.releaseBlockers).toHaveLength(1);
  });

  it("pins the exact protected source inputs and records that this audit did not rewrite truth", () => {
    const audit = read("final-release-audit.json");
    for (const [name, digest] of Object.entries(audit.auditBasis).filter(([name]) => name.endsWith("Sha256"))) {
      const sourceName = name.replace(/Sha256$/, "").replace(/^independentAudit$/, "independent-audit").replace(/^releaseStatus$/, "release-status");
      if (["gold", "metadata", "release-status", "independent-audit", "corrections"].includes(sourceName)) expect(digest).toBe(sha256(`${sourceName}.json`));
    }
    expect(audit.truthChange).toEqual({
      machineProposalChanged: false,
      rawExtractionChanged: false,
      rawEvidenceMapChanged: false,
      historicalRc2Rc3Changed: false,
      mayaRc1Rc5Changed: false,
      pr1101ChangesModified: false,
      goldChanged: false,
      independentAuditChanged: false,
      correctionsChanged: false,
    });
    expect(audit.auditBasis.rawEvidenceMapSha256).toBe(sha256("raw-evidence-map.json"));
    expect(audit.auditBasis.rawDocumentExtractionSha256).toBe(sha256("raw-document-extraction.json"));
  });
});
