import {
  validateAuditDecisionInvariants,
  type AuditInvariantFailureCode,
} from "../../../scripts/preverif/audit-rc5-maya-retrospective";

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
