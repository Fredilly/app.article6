export type MayaDocumentIdentity = {
  documentId: string;
  documentName: string;
  contentSha256: string;
};

export type MayaMachineProposalRef = {
  path: string;
  sha256: string;
  proposalState: "MACHINE_PROPOSED";
};

export type MayaAdjudicationSchemaOptions = {
  schemaVersion: string;
  document: MayaDocumentIdentity;
  machineProposalRef: MayaMachineProposalRef;
  ruleIds: string[];
  decisionCount: number;
};

const REVIEW_STATUSES = ["PENDING_INDEPENDENT_ADJUDICATION", "PROVISIONAL", "REVIEWED"] as const;

export function buildMayaAdjudicationResponseSchema(options: MayaAdjudicationSchemaOptions) {
  const decisionProperties = {
    stableRuleId: { enum: options.ruleIds },
    machineRowSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
    reviewStatus: { enum: REVIEW_STATUSES },
    expertReviewRequired: { type: "boolean" },
    finalEvidenceState: { enum: ["FOUND", "UNCLEAR", "MISSING", "N/A", null] },
    finalApplicability: { enum: ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN", null] },
    reviewerOutcome: { enum: ["CONFORMS", "ACTION_REQUIRED", "NOT_APPLICABLE", "NOT_ASSESSED", null] },
    acceptedEvidence: { type: "array", items: { $ref: "#/$defs/evidenceReference" } },
    rejectedEvidence: { type: "array", items: { $ref: "#/$defs/evidenceReference" } },
    contradictionState: { enum: ["NONE", "PRESENT", "UNRESOLVED", null] },
    draftFindingCandidate: { enum: ["NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE", null] },
    assessmentReason: { type: ["string", "null"] },
    gap: { type: ["string", "null"] },
    clientAction: { type: ["string", "null"] },
    correctionReason: { type: ["string", "null"] },
    genericFailureCategory: { enum: ["NONE", "RETRIEVAL", "ASSESSMENT", "APPLICABILITY", "PROVENANCE", "COMPONENT_COVERAGE", "RULE_MAPPING", "SOURCE_CONTRADICTION", "OTHER", null] },
    reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH", null] },
  };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: options.schemaVersion,
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "sourceDocument", "machineProposalRef", "decisions"],
    properties: {
      schemaVersion: { const: options.schemaVersion },
      sourceDocument: {
        type: "object",
        required: ["documentId", "documentName", "contentSha256"],
        properties: {
          documentId: { const: options.document.documentId },
          documentName: { const: options.document.documentName },
          contentSha256: { const: options.document.contentSha256 },
        },
        additionalProperties: false,
      },
      machineProposalRef: {
        type: "object",
        required: ["path", "sha256", "proposalState"],
        properties: {
          path: { const: options.machineProposalRef.path },
          sha256: { const: options.machineProposalRef.sha256 },
          proposalState: { const: options.machineProposalRef.proposalState },
        },
        additionalProperties: false,
      },
      decisions: {
        type: "array",
        minItems: options.decisionCount,
        maxItems: options.decisionCount,
        items: { $ref: "#/$defs/decision" },
      },
    },
    $defs: {
      evidenceReference: {
        type: "object",
        additionalProperties: false,
        required: ["quote", "page", "sectionHeading", "spanId", "documentId", "documentSha256"],
        properties: {
          quote: { type: "string", minLength: 1 },
          page: { type: "integer", minimum: 1 },
          sectionHeading: { type: "string", minLength: 1 },
          spanId: { type: "string", minLength: 1 },
          documentId: { const: options.document.documentId },
          documentSha256: { const: options.document.contentSha256 },
          evidenceType: { type: "string" },
          reason: { type: "string" },
        },
      },
      decision: {
        type: "object",
        additionalProperties: false,
        required: ["stableRuleId", "machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "genericFailureCategory", "reviewerConfidence"],
        properties: decisionProperties,
        allOf: [
          {
            if: { properties: { reviewStatus: { const: "REVIEWED" } } },
            then: {
              properties: {
                finalEvidenceState: { type: "string" },
                finalApplicability: { type: "string" },
                reviewerOutcome: { type: "string" },
                contradictionState: { type: "string" },
                assessmentReason: { type: "string", minLength: 1 },
                correctionReason: { type: "string", minLength: 1 },
                genericFailureCategory: { type: "string" },
                reviewerConfidence: { type: "string" },
              },
            },
          },
          {
            if: { properties: { reviewStatus: { const: "PROVISIONAL" } } },
            then: { properties: { expertReviewRequired: { const: true } } },
          },
        ],
      },
    },
  };
}
