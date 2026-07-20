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
      goldChanged: true,
      independentAuditChanged: false,
      correctionsChanged: true,
    });
    expect(audit.auditBasis.rawEvidenceMapSha256).toBe(sha256("raw-evidence-map.json"));
    expect(audit.auditBasis.rawDocumentExtractionSha256).toBe(sha256("raw-document-extraction.json"));
  });

  it("requires the ten audited rejected records to be flat and fully auditable without changing their meaning", () => {
    const gold = read("gold.json");
    const corrections = read("corrections.json");
    const affected = new Set(["R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005"]);
    const expectedReason = "generic-text false support; wrong applicability pathway; incomplete or non-project-specific evidence";
    const rows = gold.rows.filter((row: any) => affected.has(row.ruleReference));
    expect(rows).toHaveLength(10);
    expect(corrections.rejectedEvidence.filter((entry: any) => affected.has(shortId(entry.ruleId)))).toHaveLength(10);
    for (const row of rows) {
      expect(row.rejectedEvidence).toHaveLength(1);
      const evidence = row.rejectedEvidence[0];
      expect(evidence).not.toHaveProperty("evidence");
      expect(evidence).toEqual(expect.objectContaining({ page: 18, section: "3.5.5 The determination of baseline scenario and demonstration of additionality for an eligibility area", spanId: "manual:marcondes-pdd:page-18:r-3-5-5-rejected", rejectionReason: expectedReason }));
      expect(evidence.provenance).toEqual(expect.objectContaining({ docId: "quick-check-review-question", page: 18, spanId: evidence.spanId, sectionHeading: evidence.section, provenanceKind: "manual" }));
      expect(evidence.provenance.sectionPath).toEqual(["2 PROJECT DETAILS", evidence.section]);
      expect(evidence.quote).toBe("The determination of the baseline scenario and demonstration of additionality for the eligibility area are based on the initial project activity instances implemented across 36 properties located within the municipalities of Nhamundá, Parintins, and Barreirinha in the state of Amazonas, within the Amazon Biome.");
      expect(row.acceptedEvidence).toEqual(expect.any(Array));
      expect(row.finalEvidenceState).toBeDefined();
      expect(row.reviewerOutcome).toBeDefined();
    }
    for (const entry of corrections.rejectedEvidence.filter((candidate: any) => affected.has(shortId(candidate.ruleId)))) {
      expect(entry).not.toHaveProperty("evidence");
      expect(entry.page).toBe(18);
      expect(entry.spanId).toBe(entry.provenance.spanId);
      expect(entry.provenance.page).toBe(entry.page);
      expect(entry.rejectionReason).toBe(expectedReason);
    }
  });
});
