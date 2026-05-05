import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RequirementCoverageExpectedEvidenceType } from "@/app/m/_lib/requirementCoverage";
import type { ClientReadinessDocument } from "@/lib/readiness/clientReadinessReport";
import type { ReadinessGapSeverity, ReadinessGapState, RuleReadinessGap } from "@/lib/readiness/gapEngine";
import type { EvidenceAttachment, ReviewStatus } from "@/lib/verify/reviewStore";

export type VvbWorkpaperReviewInput = {
  status: ReviewStatus;
  rationale?: string | null;
  supportReference?: string | null;
  evidenceLink?: string | null;
  evidenceAttachments?: EvidenceAttachment[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  updatedAt?: string | null;
};

export type VvbReviewerArtifactInput = {
  savedAt?: string | null;
  minutes?: string | null;
  outcomeNote?: string | null;
};

export type VvbWorkpaperEvidenceReference = {
  id: string;
  label: string;
  type: string;
  source: string;
  linkedRuleIds: string[];
  referenceState: "linked_evidence" | "candidate_evidence" | "review_attachment" | "supplied_document";
  includedInExport: false;
  note: string;
};

export type VvbWorkpaperBundleReference = {
  label: string;
  value: string;
  availability: "available" | "unavailable";
};

export type VvbWorkpaperReport = {
  reportId: string;
  generatedAt: string;
  projectMethodVersionContext: {
    projectName: string;
    projectId: string;
    proponent: string;
    region: string;
    projectDescription: string;
    methodologyCode: string;
    methodologyVersion: string;
    methodologyName: string;
    sector: string;
  };
  registryAndProgramContext: {
    registryProgram: string;
    registryProjectId: string;
    note: string;
  };
  workpaperStatus: {
    label: "Draft workpaper support";
    sourceRunId: string;
    artifactState: string;
    generatedAt: string;
    note: string;
  };
  executiveSummary: {
    headline: string;
    totals: {
      rules: number;
      reviewed: number;
      pendingOrNotReviewed: number;
      needsFollowup: number;
      missingEvidence: number;
      unknownExpectation: number;
      reviewerArtifactSaved: number;
    };
    note: string;
  };
  ruleReviewWorkpaperTable: Array<{
    ruleId: string;
    ruleTitle: string;
    reviewStatus: ReviewStatus | "not_reviewed";
    reviewStatusLabel: string;
    reviewerRationale: string;
    supportReference: string;
    evidenceLink: string;
    linkedEvidenceRefs: string[];
    candidateEvidenceRefs: string[];
    attachmentRefs: string[];
  }>;
  readinessGapStatus: Array<{
    ruleId: string;
    ruleTitle: string;
    readinessState: ReadinessGapState;
    severity: ReadinessGapSeverity;
    summary: string;
    expectedEvidence: string[];
    missingEvidence: string[];
    nextActions: string[];
  }>;
  reviewerArtifactState: Array<{
    ruleId: string;
    ruleTitle: string;
    state: "saved" | "missing";
    savedAt: string;
    note: string;
  }>;
  evidenceProvenanceReferences: {
    suppliedDocuments: ClientReadinessDocument[];
    missingDocuments: ClientReadinessDocument[];
    evidenceReferenceIndex: VvbWorkpaperEvidenceReference[];
    bundleReferences: VvbWorkpaperBundleReference[];
  };
  limitationsAndNonClaims: {
    limitations: string[];
    nonClaims: string[];
  };
  technicalAppendix: {
    generatedAt: string;
    stateDefinitions: Array<{
      state: ReadinessGapState;
      description: string;
    }>;
  };
};

export type BuildVvbWorkpaperReportInput = {
  reportId: string;
  generatedAt: string;
  project: {
    name: string;
    projectId?: string;
    proponent?: string;
    region?: string;
    description?: string;
  };
  methodology: {
    code: string;
    version: string;
    name?: string;
    sector?: string;
  };
  registry?: {
    program?: string | null;
    projectId?: string | null;
    note?: string | null;
  };
  suppliedDocuments?: ClientReadinessDocument[];
  missingDocuments?: ClientReadinessDocument[];
  readinessGaps: RuleReadinessGap[];
  reviewsByRuleId?: Record<string, VvbWorkpaperReviewInput>;
  reviewerArtifactsByRuleId?: Record<string, VvbReviewerArtifactInput>;
  provenance?: {
    sourceRunId?: string | null;
    artifactState?: string | null;
    snapshotExportedAt?: string | null;
    finalizedAt?: string | null;
    auditPackReference?: string | null;
    clientReadinessReference?: string | null;
    traceBundleReference?: string | null;
  };
};

function expectedEvidenceLabel(type: RequirementCoverageExpectedEvidenceType): string {
  return EXPECTED_EVIDENCE_LABELS[type] ?? type;
}

function evidenceLabel(item: RuleReadinessGap["linkedEvidence"][number]): string {
  return item.title?.trim() || item.fragmentLabel?.trim() || item.documentLabel?.trim() || item.id;
}

function statusLabel(status: ReviewStatus | "not_reviewed"): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "not_verified":
      return "Not verified";
    case "needs_followup":
      return "Needs follow-up";
    case "pending":
      return "Pending reviewer confirmation";
    case "not_reviewed":
      return "Not reviewed";
  }
}

function stateDescription(state: ReadinessGapState): string {
  switch (state) {
    case "ready":
      return "Expected evidence is linked and reviewer artifact state is saved for readiness support.";
    case "needs_review":
      return "Evidence is linked, but reviewer clarification is still needed before the row is stable.";
    case "missing_evidence":
      return "Expected evidence is partly or wholly missing.";
    case "missing_reviewer_record":
      return "Evidence is linked, but reviewer artifact state is not saved.";
    case "not_started":
      return "No linked evidence has been assembled against the expected evidence set.";
    case "unknown_expectation":
      return "Methodology-owned expectation metadata is not specific enough to assess the rule consistently.";
  }
}

function reviewerArtifactSaved(artifact?: VvbReviewerArtifactInput | null): boolean {
  if (!artifact) return false;
  return Boolean(artifact.savedAt?.trim() || artifact.minutes?.trim() || artifact.outcomeNote?.trim());
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function referenceStatePriority(state: VvbWorkpaperEvidenceReference["referenceState"]): number {
  switch (state) {
    case "linked_evidence":
      return 4;
    case "review_attachment":
      return 3;
    case "candidate_evidence":
      return 2;
    case "supplied_document":
      return 1;
  }
}

function upsertEvidenceReference(
  byId: Map<string, VvbWorkpaperEvidenceReference>,
  next: VvbWorkpaperEvidenceReference,
): void {
  const current = byId.get(next.id);
  if (!current) {
    byId.set(next.id, {
      ...next,
      linkedRuleIds: sortedUnique(next.linkedRuleIds),
    });
    return;
  }
  byId.set(next.id, {
    ...current,
    label: current.label || next.label,
    type: current.type || next.type,
    source: current.source || next.source,
    linkedRuleIds: sortedUnique([...current.linkedRuleIds, ...next.linkedRuleIds]),
    referenceState:
      referenceStatePriority(next.referenceState) > referenceStatePriority(current.referenceState)
        ? next.referenceState
        : current.referenceState,
    note:
      referenceStatePriority(next.referenceState) > referenceStatePriority(current.referenceState)
        ? next.note
        : current.note,
  });
}

function buildEvidenceReferenceIndex(input: BuildVvbWorkpaperReportInput): VvbWorkpaperEvidenceReference[] {
  const byId = new Map<string, VvbWorkpaperEvidenceReference>();

  for (const document of input.suppliedDocuments ?? []) {
    upsertEvidenceReference(byId, {
      id: document.id,
      label: document.label,
      type: document.type,
      source: document.note?.trim() || "Supplied document record",
      linkedRuleIds: [],
      referenceState: "supplied_document",
      includedInExport: false,
      note: document.note?.trim() || "Supplied document record only. File packaging is not implied here.",
    });
  }

  for (const gap of input.readinessGaps) {
    for (const item of gap.linkedEvidence) {
      upsertEvidenceReference(byId, {
        id: item.id,
        label: evidenceLabel(item),
        type: item.type,
        source: item.source,
        linkedRuleIds: [gap.ruleId],
        referenceState: "linked_evidence",
        includedInExport: false,
        note: "Linked workspace evidence reference.",
      });
    }
    for (const item of gap.candidateEvidence) {
      upsertEvidenceReference(byId, {
        id: item.id,
        label: evidenceLabel(item),
        type: item.type,
        source: item.source,
        linkedRuleIds: [gap.ruleId],
        referenceState: "candidate_evidence",
        includedInExport: false,
        note: "Candidate evidence suggestion only. This is not treated as accepted support.",
      });
    }
  }

  for (const [ruleId, review] of Object.entries(input.reviewsByRuleId ?? {})) {
    for (const attachment of review.evidenceAttachments ?? []) {
      upsertEvidenceReference(byId, {
        id: `${ruleId}:${attachment.id}`,
        label: attachment.label,
        type: attachment.type,
        source: attachment.url?.trim() || "Local reviewer attachment reference",
        linkedRuleIds: [ruleId],
        referenceState: "review_attachment",
        includedInExport: false,
        note:
          attachment.type === "url" && attachment.url?.trim()
            ? `Reviewer attachment reference: ${attachment.url.trim()}`
            : "Reviewer attachment reference only.",
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function buildVvbWorkpaperReport(input: BuildVvbWorkpaperReportInput): VvbWorkpaperReport {
  const readinessGaps = [...input.readinessGaps].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const reviewedCount = readinessGaps.filter((gap) => {
    const status = input.reviewsByRuleId?.[gap.ruleId]?.status;
    return status && status !== "pending";
  }).length;
  const reviewerArtifactSavedCount = readinessGaps.filter((gap) => reviewerArtifactSaved(input.reviewerArtifactsByRuleId?.[gap.ruleId])).length;
  const evidenceReferenceIndex = buildEvidenceReferenceIndex(input);
  const workpaperHeadline =
    reviewedCount > 0
      ? "Draft VVB workpaper support assembled from local rule reviews, readiness gaps, and evidence references."
      : "Draft VVB workpaper support assembled from readiness gaps and evidence references. Reviewer judgments remain largely unrecorded.";

  return {
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    projectMethodVersionContext: {
      projectName: input.project.name.trim() || "Not provided",
      projectId: input.project.projectId?.trim() || "Not provided",
      proponent: input.project.proponent?.trim() || "Not provided",
      region: input.project.region?.trim() || "Not provided",
      projectDescription: input.project.description?.trim() || "Not provided",
      methodologyCode: input.methodology.code.trim(),
      methodologyVersion: input.methodology.version.trim(),
      methodologyName: input.methodology.name?.trim() || "Not provided",
      sector: input.methodology.sector?.trim() || "Not provided",
    },
    registryAndProgramContext: {
      registryProgram: input.registry?.program?.trim() || "Not provided",
      registryProjectId: input.registry?.projectId?.trim() || "Not provided",
      note:
        input.registry?.note?.trim() ||
        "Registry-specific context is not carried in the current workspace unless it is entered explicitly.",
    },
    workpaperStatus: {
      label: "Draft workpaper support",
      sourceRunId: input.provenance?.sourceRunId?.trim() || "Unavailable",
      artifactState: input.provenance?.artifactState?.trim() || "Unavailable",
      generatedAt: input.generatedAt,
      note:
        "This export supports VVB-style workpaper preparation. It does not express a verifier conclusion and does not convert pending rows into satisfied review results.",
    },
    executiveSummary: {
      headline: workpaperHeadline,
      totals: {
        rules: readinessGaps.length,
        reviewed: reviewedCount,
        pendingOrNotReviewed: readinessGaps.length - reviewedCount,
        needsFollowup: readinessGaps.filter((gap) => input.reviewsByRuleId?.[gap.ruleId]?.status === "needs_followup").length,
        missingEvidence: readinessGaps.filter((gap) => gap.state === "missing_evidence" || gap.state === "not_started").length,
        unknownExpectation: readinessGaps.filter((gap) => gap.state === "unknown_expectation").length,
        reviewerArtifactSaved: reviewerArtifactSavedCount,
      },
      note:
        "Pending and not-reviewed rows remain draft review records only. Candidate evidence remains suggestion-only until a reviewer explicitly records a judgment.",
    },
    ruleReviewWorkpaperTable: readinessGaps.map((gap) => {
      const review = input.reviewsByRuleId?.[gap.ruleId];
      const reviewStatus = review?.status ?? "not_reviewed";
      return {
        ruleId: gap.ruleId,
        ruleTitle: gap.title,
        reviewStatus,
        reviewStatusLabel: statusLabel(reviewStatus),
        reviewerRationale: review?.rationale?.trim() || "Not reviewed.",
        supportReference: review?.supportReference?.trim() || "Not provided.",
        evidenceLink: review?.evidenceLink?.trim() || "Not provided.",
        linkedEvidenceRefs: sortedUnique(gap.linkedEvidence.map((item) => item.id)),
        candidateEvidenceRefs: sortedUnique(gap.candidateEvidence.map((item) => item.id)),
        attachmentRefs: sortedUnique((review?.evidenceAttachments ?? []).map((item) => item.id)),
      };
    }),
    readinessGapStatus: readinessGaps.map((gap) => ({
      ruleId: gap.ruleId,
      ruleTitle: gap.title,
      readinessState: gap.state,
      severity: gap.severity,
      summary: gap.summary,
      expectedEvidence: gap.expectedEvidenceTypes.map(expectedEvidenceLabel),
      missingEvidence: gap.missingExpectedEvidenceTypes.map(expectedEvidenceLabel),
      nextActions: gap.recommendations.map((item) => item.label),
    })),
    reviewerArtifactState: readinessGaps.map((gap) => {
      const artifact = input.reviewerArtifactsByRuleId?.[gap.ruleId];
      const saved = reviewerArtifactSaved(artifact);
      return {
        ruleId: gap.ruleId,
        ruleTitle: gap.title,
        state: saved ? "saved" : "missing",
        savedAt: artifact?.savedAt?.trim() || "Not saved",
        note: saved
          ? "Reviewer artifact state is saved for this rule."
          : "No saved reviewer artifact state is recorded for this rule yet.",
      };
    }),
    evidenceProvenanceReferences: {
      suppliedDocuments: [...(input.suppliedDocuments ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
      missingDocuments: [...(input.missingDocuments ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
      evidenceReferenceIndex,
      bundleReferences: [
        {
          label: "Source Verify run",
          value: input.provenance?.sourceRunId?.trim() || "Unavailable",
          availability: input.provenance?.sourceRunId?.trim() ? "available" : "unavailable",
        },
        {
          label: "Snapshot exported at",
          value: input.provenance?.snapshotExportedAt?.trim() || "Unavailable",
          availability: input.provenance?.snapshotExportedAt?.trim() ? "available" : "unavailable",
        },
        {
          label: "Finalized at",
          value: input.provenance?.finalizedAt?.trim() || "Unavailable",
          availability: input.provenance?.finalizedAt?.trim() ? "available" : "unavailable",
        },
        {
          label: "Audit-pack reference",
          value: input.provenance?.auditPackReference?.trim() || "Unavailable",
          availability: input.provenance?.auditPackReference?.trim() ? "available" : "unavailable",
        },
        {
          label: "Client readiness reference",
          value: input.provenance?.clientReadinessReference?.trim() || "Unavailable",
          availability: input.provenance?.clientReadinessReference?.trim() ? "available" : "unavailable",
        },
        {
          label: "Trace bundle reference",
          value: input.provenance?.traceBundleReference?.trim() || "Unavailable",
          availability: input.provenance?.traceBundleReference?.trim() ? "available" : "unavailable",
        },
      ],
    },
    limitationsAndNonClaims: {
      limitations: [
        "Derived from local Article6 review state, evidence inventory, and readiness logic available at export time.",
        "Missing evidence, missing reviewer artifact state, and not-reviewed rows remain unresolved at export time.",
        "Included references are traceability aids only unless separately packaged through another export path.",
      ],
      nonClaims: [
        "This export does not express a verifier conclusion.",
        "This export does not indicate registry acceptance or project approval.",
        "This export does not indicate issuance or eligibility of credits.",
        "This export does not convert pending or candidate-only material into accepted support.",
      ],
    },
    technicalAppendix: {
      generatedAt: input.generatedAt,
      stateDefinitions: [
        { state: "ready", description: stateDescription("ready") },
        { state: "needs_review", description: stateDescription("needs_review") },
        { state: "missing_evidence", description: stateDescription("missing_evidence") },
        { state: "missing_reviewer_record", description: stateDescription("missing_reviewer_record") },
        { state: "not_started", description: stateDescription("not_started") },
        { state: "unknown_expectation", description: stateDescription("unknown_expectation") },
      ],
    },
  };
}
