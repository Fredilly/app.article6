import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { loadReviewedEvidenceMapCandidate } from "@/lib/preverif/reviewedEvidenceMapServerRegistry";
import {
  generateValidationRules,
  getValidationFixture,
  loadValidationFixtures,
} from "../../fixtures/preverif/validationFixtureContract";

const schema = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/preverif/validation-fixture.schema.json"),
  "utf8",
));
const fixtures = loadValidationFixtures();
const maya = getValidationFixture("maya-forest-corridor-redd-belize-validation");
const unseen = getValidationFixture("unseen-vm0007-v18-validation");

describe("RC5 VM0007 validation fixtures", () => {
  it("registers Maya with stable PDF identity and only ingestion metadata", () => {
    expect(maya.pdf).toEqual(expect.objectContaining({
      fileName: "12-maya-forest-corridor-redd-belize.pdf",
      sha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
    }));
    const bytes = fs.readFileSync(path.join(process.cwd(), maya.pdf.sourcePath!));
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(maya.pdf.sha256);
    expect(maya.methodology).toEqual({ id: "VM0007", version: "v1.8" });
    expect(maya.project).toEqual(expect.objectContaining({ id: "5294", name: "Maya Forest Corridor REDD Project" }));
    expect(maya).not.toHaveProperty("gold");
    expect(maya).not.toHaveProperty("reviewedEvidence");
  });

  it("generates Maya's 58 rules through the VM0007 v1.8 methodology contract", async () => {
    const generated = await generateValidationRules(maya);
    expect(generated.source).toBe("rules.rich.json");
    expect(generated.rules).toHaveLength(58);
    expect(maya.generatedRuleCount).toBe(generated.rules.length);
  });

  it("keeps Maya validation identity out of Marcondes reviewed truth", () => {
    expect(loadReviewedEvidenceMapCandidate({
      sourcePdfSha256: maya.pdf.sha256,
      sourceDocumentId: "maya-forest-corridor-redd-belize-extracted",
    })).toBeNull();
  });

  it("keeps the unseen fixture empty and unable to carry reviewed artifacts", async () => {
    expect(unseen.pdf).toEqual({ fileName: null, sourcePath: null, sha256: null });
    expect(unseen.project).toEqual({});
    expect(unseen).not.toHaveProperty("generatedRuleCount");
    expect(unseen).not.toHaveProperty("expectedOutcomes");
    expect(unseen).not.toHaveProperty("acceptedEvidence");
    expect(unseen).not.toHaveProperty("reviewerHistory");
    expect(loadReviewedEvidenceMapCandidate({ sourcePdfSha256: unseen.pdf.sha256 })).toBeNull();
    const generated = await generateValidationRules(unseen);
    expect(generated.rules).toHaveLength(58);
  });

  it("rejects reviewed fields and prevents validation fixture identifier collisions", () => {
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    for (const fixture of fixtures) expect(validate(fixture)).toBe(true);
    expect(new Set(fixtures.map((fixture) => fixture.fixtureId)).size).toBe(fixtures.length);
    expect(validate({ ...unseen, gold: {} })).toBe(false);
    expect(validate({ ...unseen, reviewedEvidence: [] })).toBe(false);
    expect(validate({ ...unseen, expectedOutcomes: {} })).toBe(false);
  });

  it("does not define expected rule rows in the validation fixture", () => {
    expect(JSON.stringify(fixtures)).not.toContain("ruleReference");
    expect(JSON.stringify(fixtures)).not.toContain("finalEvidenceState");
    expect(JSON.stringify(fixtures)).not.toContain("goldCorrections");
  });
});
