import {
  validateEvidenceMapDependency,
  type EvidenceMapAcceptedEvidence,
  type EvidenceMapRejectedEvidence,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";

const acceptedEvidence: EvidenceMapAcceptedEvidence = {
  evidenceId: "accepted-1",
  quote: "The requirement is addressed in the source document.",
  provenance: {
    docId: "document-1",
    page: 4,
    sectionPath: ["4", "4.1"],
    spanId: "span-1",
    sectionHeading: "Requirement evidence",
    sourceType: "uploaded-document",
  },
};

const rejectedEvidence: EvidenceMapRejectedEvidence = {
  evidenceId: "rejected-1",
  quote: "A related but insufficient statement.",
  rejectionReason: "Does not establish the requirement for the reviewed source.",
  provenance: {
    docId: "document-1",
    page: 5,
    sectionPath: ["5"],
    spanId: "span-2",
    sectionHeading: "Related material",
    sourceType: "uploaded-document",
  },
};

function makeRow(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "row-1",
    requirement: {
      requirementId: "requirement-1",
      requirementReference: "REQ-1",
      requirementText: "The project must document the requirement.",
    },
    methodology: {
      methodologyId: "METHOD-1",
      rulebookVersion: "v1.0",
    },
    upstreamStatus: "UNCLEAR",
    applicabilityState: "UNKNOWN",
    acceptedEvidence: [acceptedEvidence],
    rejectedEvidence: [rejectedEvidence],
    assessmentReason: "The row has been assessed against the available source.",
    clientAction: null,
    searchCoverage: {
      searched: true,
      searchedDocumentIds: ["document-1"],
      notes: null,
    },
    sourceDocument: {
      documentId: "document-1",
      documentName: "source-document.pdf",
      contentSha256: null,
    },
    evidenceProvenance: [acceptedEvidence.provenance, rejectedEvidence.provenance],
    finalizationState: "finalized",
    ...overrides,
  };
}

function without(row: EvidenceMapRow, field: string): Record<string, unknown> {
  const candidate = { ...row } as Record<string, unknown>;
  delete candidate[field];
  return candidate;
}

describe("validateEvidenceMapDependency", () => {
  it("accepts a complete finalized row", () => {
    const row = makeRow();

    expect(validateEvidenceMapDependency(row)).toEqual({ ready: true, row });
  });

  it("blocks a non-finalized row", () => {
    const result = validateEvidenceMapDependency(makeRow({ finalizationState: "draft" }));

    expect(result).toEqual({ ready: false, blockedBy: ["row_not_finalized"] });
  });

  it.each([
    ["acceptedEvidence", "missing_accepted_evidence_field"],
    ["rejectedEvidence", "missing_rejected_evidence_field"],
  ])("blocks an omitted %s field", (field, reason) => {
    const result = validateEvidenceMapDependency(without(makeRow(), field));

    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.blockedBy).toContain(reason);
  });

  it("retains explicit empty evidence arrays", () => {
    const row = makeRow({ acceptedEvidence: [], rejectedEvidence: [] });
    const result = validateEvidenceMapDependency(row);

    expect(result).toEqual({ ready: true, row });
    if (result.ready) {
      expect(result.row.acceptedEvidence).toBe(row.acceptedEvidence);
      expect(result.row.rejectedEvidence).toBe(row.rejectedEvidence);
    }
  });

  it("blocks a missing assessment reason", () => {
    const result = validateEvidenceMapDependency(without(makeRow(), "assessmentReason"));

    expect(result).toEqual({ ready: false, blockedBy: ["missing_assessment_reason"] });
  });

  it("requires the client-action field but allows explicit null", () => {
    const allowed = validateEvidenceMapDependency(makeRow({ clientAction: null }));
    const blocked = validateEvidenceMapDependency(without(makeRow(), "clientAction"));

    expect(allowed.ready).toBe(true);
    expect(blocked).toEqual({ ready: false, blockedBy: ["missing_client_action_field"] });
  });

  it("blocks missing search coverage information", () => {
    const result = validateEvidenceMapDependency(without(makeRow(), "searchCoverage"));

    expect(result).toEqual({ ready: false, blockedBy: ["missing_search_coverage_field"] });
  });

  it("blocks missing source-document identity and provenance", () => {
    const row = without(makeRow(), "sourceDocument");
    delete row.evidenceProvenance;
    const result = validateEvidenceMapDependency(row);

    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.blockedBy).toEqual([
        "missing_source_document_identity",
        "missing_provenance",
      ]);
    }
  });

  it("returns accepted and rejected evidence unchanged", () => {
    const row = makeRow();
    const result = validateEvidenceMapDependency(row);

    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.row.acceptedEvidence).toEqual(row.acceptedEvidence);
      expect(result.row.rejectedEvidence).toEqual(row.rejectedEvidence);
      expect(result.row.evidenceProvenance).toEqual(row.evidenceProvenance);
    }
  });

  it("does not rename or reinterpret the upstream status", () => {
    const row = makeRow({ upstreamStatus: "no_evidence" });
    const result = validateEvidenceMapDependency(row);

    expect(result.ready).toBe(true);
    if (result.ready) expect(result.row.upstreamStatus).toBe("no_evidence");
  });

  it("does not mutate its input", () => {
    const row = makeRow();
    const before = structuredClone(row);

    validateEvidenceMapDependency(row);

    expect(row).toEqual(before);
  });

  it("blocks incomplete methodology identity without judging applicability", () => {
    const missingId = validateEvidenceMapDependency(makeRow({
      methodology: { methodologyId: "", rulebookVersion: "v1.0" },
    }));
    const missingVersion = validateEvidenceMapDependency(makeRow({
      methodology: { methodologyId: "METHOD-1", rulebookVersion: "" },
    }));
    const explicitlyNotRequired = validateEvidenceMapDependency(makeRow({ methodology: null }));

    expect(missingId).toEqual({ ready: false, blockedBy: ["missing_methodology_identity"] });
    expect(missingVersion).toEqual({ ready: false, blockedBy: ["missing_methodology_version"] });
    expect(explicitlyNotRequired.ready).toBe(true);
  });

  it("is generic and accepts ordinary non-fixture row identities", () => {
    const result = validateEvidenceMapDependency(makeRow({
      rowId: "generic-row",
      requirement: {
        requirementId: "generic-requirement",
        requirementReference: "STANDARD-1",
        requirementText: "A generic requirement.",
      },
    }));

    expect(result.ready).toBe(true);
  });
});
