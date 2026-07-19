import {
  authorizedBlockerResolutionPacketPath,
  authorizedBlockerResolutionPacketSha256,
  authorizedTargetedPacketPath,
  authorizedTargetedPacketSha256,
  authorizedTargetedRuleIds,
  authorizedIndependentBatch3PacketPath,
  authorizedIndependentBatch3PacketSha256,
  authorizedIndependentBatch3RuleIds,
  loadAuthorizedBlockerResolutionContexts,
  validateAuditDecisionInvariants,
  type AuditInvariantFailureCode,
} from "../../../scripts/preverif/audit-rc5-maya-retrospective";
import fs from "node:fs";
import path from "node:path";

type Fixture = {
  decision: Record<string, any>;
  contexts: Record<string, any>[];
};

const evidence = {
  quote: "The project applies the methodology requirements.",
  page: 84,
  sectionHeading: "Methodology requirements",
  spanId: "ctx-001",
  documentId: "maya-pdd.pdf",
  documentSha256: "document-sha256",
};

const context = {
  contextId: "ctx-001",
  exactQuote: evidence.quote,
  pageNumber: evidence.page,
  sectionHeading: evidence.sectionHeading,
  sourceSpanId: evidence.spanId,
  documentIdentity: {
    documentId: evidence.documentId,
    contentSha256: evidence.documentSha256,
  },
};

function validFixture(): Fixture {
  return {
    decision: {
      stableRuleId: "rule-001",
      acceptedEvidence: [{ ...evidence }],
      rejectedEvidence: [],
      finalApplicability: "APPLICABLE",
      finalEvidenceState: "FOUND",
      reviewerOutcome: "CONFORMS",
      clientAction: "",
      correctionReason: "The accepted evidence supports the reviewed decision.",
    },
    contexts: [{ ...context, documentIdentity: { ...context.documentIdentity } }],
  };
}

function failureCodes(fixture: Fixture): AuditInvariantFailureCode[] {
  return validateAuditDecisionInvariants(fixture.decision, fixture.contexts).failures.map((failure) => failure.code);
}

describe("RC5 retrospective audit mutation coverage", () => {
  it("accepts the current 45/13 truth through all authorized frozen packet sources", () => {
    const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-retrospective-audit/retrospective-audit-report.json"), "utf8"));
    expect(report.mechanicalResult).toBe(true);
    expect(report.authorizedFrozenEvidenceSources).toEqual([
      { path: authorizedBlockerResolutionPacketPath, sha256: authorizedBlockerResolutionPacketSha256, ruleIds: ["Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0013"] },
      { path: authorizedTargetedPacketPath, sha256: authorizedTargetedPacketSha256, ruleIds: [...authorizedTargetedRuleIds].sort() },
      { path: authorizedIndependentBatch3PacketPath, sha256: authorizedIndependentBatch3PacketSha256, ruleIds: [...authorizedIndependentBatch3RuleIds].sort() },
    ]);
    const truth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json"), "utf8"));
    const contexts = loadAuthorizedBlockerResolutionContexts();
    for (const ruleId of ["Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0013"]) {
      const row = truth.decisions.find((decision: any) => decision.stableRuleId === ruleId);
      const acceptedOnly = { ...row, rejectedEvidence: [] };
      expect(validateAuditDecisionInvariants(acceptedOnly, contexts).provenanceResult).toBe("PASS");
    }
  });

  it("rejects exact-evidence mutations and unrelated packet sources", () => {
    const truth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json"), "utf8"));
    const contexts = loadAuthorizedBlockerResolutionContexts();
    const row = truth.decisions.find((decision: any) => decision.stableRuleId === "Verra.AFOLU.VM0007.v1-8.R-1-0012");
    for (const field of ["quote", "page", "sectionHeading", "spanId", "documentId", "documentSha256"]) {
      const mutated = JSON.parse(JSON.stringify({ ...row, rejectedEvidence: [] }));
      mutated.acceptedEvidence[0][field] = field === "page" ? 999 : `${mutated.acceptedEvidence[0][field]}-mutated`;
      expect(validateAuditDecisionInvariants(mutated, contexts).provenanceResult).toBe("FAIL");
    }
    expect(() => loadAuthorizedBlockerResolutionContexts(path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/review-packet.json"))).toThrow(/SHA changed/);
    const allTruthFiles = ["maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((batch) => `rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json` )];
    const allRows = allTruthFiles.flatMap((file) => JSON.parse(fs.readFileSync(path.join(process.cwd(), `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/${file}`), "utf8")).decisions);
    expect(allRows.filter((decision: any) => decision.reviewStatus === "REVIEWED")).toHaveLength(45);
    expect(allRows.filter((decision: any) => decision.reviewStatus === "PROVISIONAL")).toHaveLength(13);
  });

  it("passes a valid reviewed decision through all six invariant checks", () => {
    const result = validateAuditDecisionInvariants(validFixture().decision, validFixture().contexts);

    expect(result.provenanceResult).toBe("PASS");
    expect(result.semanticIntegrityResult).toBe("PASS");
    expect(result.failures).toHaveLength(0);
  });

  it("reports unmatched frozen evidence with the affected rule and evidence location", () => {
    const fixture = validFixture();
    fixture.decision.acceptedEvidence[0].page = 85;

    const result = validateAuditDecisionInvariants(fixture.decision, fixture.contexts);

    expect(result.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "UNMATCHED_FROZEN_EVIDENCE",
        stableRuleId: "rule-001",
        field: "acceptedEvidence",
        index: 0,
        evidence: expect.objectContaining({ page: 85 }),
      }),
    ]));
    expect(result.provenanceResult).toBe("FAIL");
  });

  it("rejects accepted/rejected duplicate evidence", () => {
    const fixture = validFixture();
    fixture.decision.rejectedEvidence = [{ ...fixture.decision.acceptedEvidence[0] }];

    expect(failureCodes(fixture)).toEqual(["DUPLICATE_EVIDENCE"]);
  });

  it("rejects unsupported NOT_APPLICABLE decisions", () => {
    const fixture = validFixture();
    fixture.decision.acceptedEvidence = [];
    fixture.decision.finalApplicability = "NOT_APPLICABLE";
    fixture.decision.finalEvidenceState = "MISSING";
    fixture.decision.reviewerOutcome = "NEEDS_REVIEW";

    expect(failureCodes(fixture)).toEqual(["UNSUPPORTED_NOT_APPLICABLE"]);
  });

  it("rejects a resolved N/A row with a client action", () => {
    const fixture = validFixture();
    fixture.decision.finalApplicability = "NOT_APPLICABLE";
    fixture.decision.reviewerOutcome = "NOT_APPLICABLE";
    fixture.decision.clientAction = "Explain the exclusion to the client.";

    expect(failureCodes(fixture)).toEqual(["RESOLVED_ROW_CLIENT_ACTION"]);
  });

  it("rejects FOUND/CONFORMS with a client action", () => {
    const fixture = validFixture();
    fixture.decision.clientAction = "Request a follow-up explanation.";

    expect(failureCodes(fixture)).toEqual(["RESOLVED_ROW_CLIENT_ACTION"]);
  });

  it("rejects a stale correction reason after evidence is accepted", () => {
    const fixture = validFixture();
    fixture.decision.correctionReason = "This evidence should be accepted.";

    expect(fixture.decision.acceptedEvidence).toHaveLength(1);
    expect(fixture.decision.rejectedEvidence).toHaveLength(0);
    expect(failureCodes(fixture)).toEqual(["STALE_CORRECTION_REASON"]);
  });
});
