import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, it } from "@jest/globals";
import {
  baselineCommit,
  buildArtifacts,
  contractSnapshotPath,
  excludedRuleIds,
  extractionPath,
  machineSha,
  packetDir,
  pddPath,
  proposalPath,
  rulesPath,
  selectedRuleIds,
  truthFiles,
  vmPagesPath,
  writeArtifacts,
} from "../../../scripts/preverif/generate-rc5-maya-remaining-five-review-packet";

const root = process.cwd();
const sha = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const file = (p: string) => path.join(root, p);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function mutateJson(p: string, fn: (value: any) => void) {
  const absolute = file(p);
  const original = fs.readFileSync(absolute);
  const value = JSON.parse(original.toString("utf8"));
  fn(value);
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
  try {
    assert.throws(() => buildArtifacts());
  } finally {
    fs.writeFileSync(absolute, original);
  }
}

function mutateTruthRow(ruleId: string, fn: (row: any) => void) {
  let mutated = false;
  for (const truthFile of truthFiles) {
    const absolute = file(truthFile);
    const original = fs.readFileSync(absolute);
    const value = JSON.parse(original.toString("utf8"));
    const row = value.decisions.find((entry: any) => entry.stableRuleId === ruleId);
    if (!row) continue;
    fn(row);
    fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
    mutated = true;
    try {
      assert.throws(() => buildArtifacts());
    } finally {
      fs.writeFileSync(absolute, original);
    }
    break;
  }
  if (!mutated) throw new Error(`Missing truth row: ${ruleId}`);
}

describe("RC5-2 Maya remaining-five independent review packet", () => {
  const artifacts = buildArtifacts();
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
  const validateResponse = ajv.compile(artifacts.responseSchema);
  const packet = artifacts.packet;
  const template = artifacts.template;

  const exactAllowedEvidence = packet.rules.map((rule: any) => [
    ...rule.authoritativeMethodologyEvidence,
    ...rule.mayaProjectEvidence,
  ]);

  const reviewedResponse = clone(template);
  reviewedResponse.decisions = reviewedResponse.decisions.map((decision: any, index: number) => {
    const evidence = exactAllowedEvidence[index];
    return {
      ...decision,
      reviewStatus: "REVIEWED",
      expertReviewRequired: true,
      finalEvidenceState: "FOUND",
      finalApplicability: "APPLICABLE",
      reviewerOutcome: "CONFORMS",
      acceptedEvidence: [evidence[0]],
      rejectedEvidence: [evidence[1] ?? evidence[0]],
      assessmentReason: "Reviewed.",
      gap: null,
      clientAction: null,
      correctionReason: null,
      provisionalReason: null,
      reviewerConfidence: "LOW",
    };
  });

  const provisionalResponse = clone(template);
  provisionalResponse.decisions = provisionalResponse.decisions.map((decision: any, index: number) => {
    const evidence = exactAllowedEvidence[index];
    return {
      ...decision,
      reviewStatus: "PROVISIONAL",
      expertReviewRequired: true,
      finalEvidenceState: null,
      finalApplicability: null,
      reviewerOutcome: null,
      acceptedEvidence: [evidence[0]],
      rejectedEvidence: [evidence[1] ?? evidence[0]],
      assessmentReason: null,
      gap: null,
      clientAction: null,
      correctionReason: null,
      provisionalReason: "Authoritative interpretation remains unresolved.",
      reviewerConfidence: null,
    };
  });

  const expectValid = (candidate: any, label: string) => {
    assert.equal(validateResponse(clone(candidate)), true, `${label}: ${JSON.stringify(validateResponse.errors)}`);
  };

  const expectInvalid = (candidate: any, label: string) => {
    assert.equal(validateResponse(clone(candidate)), false, label);
  };

  it("freezes exactly five selected IDs, the 51/7/58 inventory, and the blank template", () => {
    assert.deepEqual(packet.selectedRuleIds, selectedRuleIds);
    assert.equal(packet.rules.length, 5);
    assert.deepEqual(packet.excludedRuleIds, excludedRuleIds);
    assert.deepEqual(packet.frozenInventory, {
      total: 58,
      unique: 58,
      reviewed: 51,
      provisional: 7,
      provisionalIds: [...selectedRuleIds, ...excludedRuleIds].sort(),
    });
    assert.ok(template.decisions.every((decision: any) =>
      decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" &&
      decision.finalEvidenceState === null &&
      decision.finalApplicability === null &&
      decision.reviewerOutcome === null &&
      decision.acceptedEvidence.length === 0 &&
      decision.rejectedEvidence.length === 0 &&
      decision.assessmentReason === null &&
      decision.provisionalReason === null &&
      decision.reviewerConfidence === null
    ));
    assert.equal(new Set(template.decisions.map((decision: any) => decision.stableRuleId)).size, 5);
    assert.deepEqual(template.decisions.map((decision: any) => decision.stableRuleId), selectedRuleIds);
  });

  it("loads historical truth from the immutable post-PR-1099 commit and deep-compares all seven provisional rows", () => {
    assert.equal(baselineCommit, "a9c4b79fe78dfba0e873d7e9acc22909d5a503de");
    const historical = truthFiles.flatMap((p) => JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${p}`], { cwd: root }).toString("utf8")).decisions);
    const current = truthFiles.flatMap((p) => JSON.parse(fs.readFileSync(file(p), "utf8")).decisions);
    const historicalById = new Map(historical.map((row: any) => [row.stableRuleId, row]));
    const currentById = new Map(current.map((row: any) => [row.stableRuleId, row]));
    for (const id of [...selectedRuleIds, ...excludedRuleIds]) {
      assert.deepEqual(currentById.get(id), historicalById.get(id), id);
    }
    for (const id of excludedRuleIds) assert.equal(currentById.get(id).reviewStatus, "PROVISIONAL");
  });

  it("pins the machine proposal, source documents, and exact schema bindings", () => {
    assert.equal(sha(fs.readFileSync(file(proposalPath))), machineSha);
    assert.equal(packet.frozenMachineProposal.sha256, machineSha);
    assert.equal(artifacts.manifest.sources.machineProposal.sha256, machineSha);
    assert.equal(packet.sourceDocument.contentSha256, sha(fs.readFileSync(file(pddPath))));
    assert.equal(packet.sourceDocument.documentId, template.sourceDocument.documentId);
    assert.equal(packet.sourceDocument.documentName, template.sourceDocument.documentName);
    assert.equal(artifacts.manifest.sources.methodologyPdf.sha256, sha(fs.readFileSync(file(artifacts.manifest.sources.methodologyPdf.path))));
    assert.equal(artifacts.manifest.sources.methodologyPages.sha256, sha(fs.readFileSync(file(vmPagesPath))));
    assert.equal(artifacts.manifest.sources.mayaPdd.sha256, sha(fs.readFileSync(file(pddPath))));
    assert.equal(artifacts.manifest.sources.mayaExtraction.sha256, sha(fs.readFileSync(file(extractionPath))));
    assert.equal(artifacts.manifest.sources.ruleContracts.baselineSnapshot.sha256, sha(fs.readFileSync(file(contractSnapshotPath))));
    assert.equal(artifacts.manifest.sources.ruleContracts.baselineSnapshot.sourceCommit, "87eef90379f06df40a917894a159d10a5d4c2703");
    assert.equal(artifacts.responseSchema.properties.sourceDocument.const.contentSha256, packet.sourceDocument.contentSha256);
    assert.equal(artifacts.responseSchema.properties.machineProposalRef.const.sha256, machineSha);
  });

  it("rejects exact evidence provenance mutations and cross-rule evidence reuse", () => {
    const secondRule = packet.rules[1];
    const firstAllowed = exactAllowedEvidence[0][0];
    const crossRuleEvidence = packet.rules[1].mayaProjectEvidence[0];

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ invented: true }] } : decision),
    }, "invented accepted evidence");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ sourcePath: firstAllowed.sourcePath }] } : decision),
    }, "partial evidence object");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ ...firstAllowed, sourcePath: `${firstAllowed.sourcePath}.mutated` }] } : decision),
    }, "wrong evidence path");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ ...firstAllowed, sourceSha256: `${firstAllowed.sourceSha256.slice(0, 63)}0` }] } : decision),
    }, "wrong evidence SHA");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ ...firstAllowed, page: firstAllowed.page + 1 }] } : decision),
    }, "wrong evidence page");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [{ ...firstAllowed, completeExactQuote: `${firstAllowed.completeExactQuote} mutation` }] } : decision),
    }, "modified evidence quote");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, acceptedEvidence: [crossRuleEvidence] } : decision),
    }, "cross-rule evidence reuse");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, machineRowSha256: secondRule ? packet.rules[1].machineRowSha256 : decision.machineRowSha256 } : decision),
    }, "another rule machine hash");
  });

  it("rejects invalid final-state combinations and prohibited review states", () => {
    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION" } : decision),
    }, "pending submitted response");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, finalEvidenceState: "FOUND", finalApplicability: "NOT_APPLICABLE" } : decision),
    }, "FOUND + NOT_APPLICABLE");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, finalEvidenceState: "N/A", finalApplicability: "APPLICABLE" } : decision),
    }, "N/A + APPLICABLE");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, assessmentReason: null } : decision),
    }, "reviewed null assessment reason");

    expectInvalid({
      ...reviewedResponse,
      decisions: reviewedResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, reviewerConfidence: null } : decision),
    }, "reviewed null reviewer confidence");

    expectInvalid({
      ...provisionalResponse,
      decisions: provisionalResponse.decisions.map((decision: any, index: number) =>
        index === 0 ? { ...decision, provisionalReason: null } : decision),
    }, "provisional without reason");
  });

  it("accepts one valid REVIEWED response and one valid PROVISIONAL response", () => {
    expectValid(reviewedResponse, "valid reviewed response");
    expectValid(provisionalResponse, "valid provisional response");
  });

  it("rejects source-document mutations and proves the source document is exact", () => {
    expectInvalid({ ...reviewedResponse, sourceDocument: { ...reviewedResponse.sourceDocument, contentSha256: `${reviewedResponse.sourceDocument.contentSha256.slice(0, 63)}0` } }, "mutated sourceDocument.contentSha256");
    expectInvalid({ ...reviewedResponse, sourceDocument: { ...reviewedResponse.sourceDocument, extra: true } }, "additional sourceDocument properties");
  });

  it("keeps the reviewer response schema exactly five unique decisions and deterministic regeneration stable", () => {
    assert.equal(validateResponse(reviewedResponse), true, JSON.stringify(validateResponse.errors));
    assert.equal(artifacts.responseSchema.properties.decisions.minItems, 5);
    assert.equal(artifacts.responseSchema.properties.decisions.maxItems, 5);
    assert.equal(artifacts.responseSchema.allOf.length, 5);
    assert.deepEqual(template.decisions.map((decision: any) => decision.stableRuleId), selectedRuleIds);

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-remaining-five-"));
    try {
      const result = writeArtifacts(temp);
      for (const name of ["review-packet.json", "reviewer-instructions.md", "review-response-schema.json", "review-template.json", "manifest.json"]) {
        assert.equal(fs.readFileSync(path.join(temp, name), "utf8"), fs.readFileSync(path.join(packetDir, name), "utf8"), name);
      }
      assert.equal(result.packetSha256, sha(fs.readFileSync(path.join(packetDir, "review-packet.json"))));
      assert.equal(result.manifestSha256, sha(fs.readFileSync(path.join(packetDir, "manifest.json"))));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  it("rejects frozen truth-row mutations for all selected and Appendix 17 provisional rows", () => {
    for (const ruleId of [...selectedRuleIds, ...excludedRuleIds]) {
      mutateTruthRow(ruleId, (row) => { row.assessmentReason = `${row.assessmentReason ?? ""} mutation`; });
    }
  });

  it("rejects contract, methodology, and proposal mutations", () => {
    mutateJson(rulesPath, (rules) => {
      rules.find((rule: any) => rule.id === selectedRuleIds[0]).section_context.section_title += " mutation";
    });
    mutateJson(contractSnapshotPath, (snapshot) => {
      snapshot.contracts[0].source_span_text += " mutation";
    });
    mutateJson(vmPagesPath, (pages) => {
      pages.pages.find((page: any) => page.pageNumber === 22).text += " mutation";
    });
    mutateJson(extractionPath, (pages) => {
      pages.pages.find((page: any) => page.pageNumber === 88).text += " mutation";
    });
    const original = fs.readFileSync(file(pddPath));
    fs.writeFileSync(file(pddPath), Buffer.concat([original, Buffer.from("mutation")]));
    try {
      assert.throws(() => buildArtifacts());
    } finally {
      fs.writeFileSync(file(pddPath), original);
    }
    const proposalOriginal = fs.readFileSync(file(proposalPath));
    const proposal = JSON.parse(proposalOriginal.toString("utf8"));
    proposal.rows[0].assessmentReason = `${proposal.rows[0].assessmentReason ?? ""} mutation`;
    fs.writeFileSync(file(proposalPath), `${JSON.stringify(proposal, null, 2)}\n`);
    try {
      assert.throws(() => buildArtifacts());
    } finally {
      fs.writeFileSync(file(proposalPath), proposalOriginal);
    }
  });
});
