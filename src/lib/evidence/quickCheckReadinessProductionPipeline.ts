import type { EvidenceMapRow, EvidenceMapEvidenceProvenance } from "@/lib/evidence/evidenceMapDependencyContract";
import { finalizeEvidenceMapForReadiness, type EvidenceMapAssessment } from "@/lib/evidence/projectReadinessProductionPipeline";
import { clearQuickCheckReadinessPayload, saveQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import type { Vm0007GapReportAuditRecord } from "@/lib/preverif/vm0007GapReportStore";

function provenance(record: Vm0007GapReportAuditRecord, result: Vm0007GapReportAuditRecord["audit"]["results"][number]): EvidenceMapEvidenceProvenance | null {
  if (!result.span || !result.bestEvidenceQuote) return null;
  const sourceDocument = record.sourceDocument ?? { documentId: record.evidenceFileName || record.auditId, documentName: record.evidenceFileName || null, contentSha256: null };
  return { docId: sourceDocument.documentId, page: result.page, sectionPath: result.section ? [result.section] : [], spanId: result.span, sectionHeading: result.section, sourceType: "PDD" };
}

function buildRows(record: Vm0007GapReportAuditRecord): { rows: EvidenceMapRow[]; assessments: EvidenceMapAssessment[] } {
  const sourceDocument = record.sourceDocument ?? { documentId: record.evidenceFileName || record.auditId, documentName: record.evidenceFileName || null, contentSha256: null };
  const rows: EvidenceMapRow[] = [];
  const assessments: EvidenceMapAssessment[] = [];
  for (const result of record.audit.results) {
    const p = provenance(record, result);
    const accepted = result.status === "supported_by_pdd" && p ? [{ evidenceId: `audit:${result.ruleId}:accepted`, quote: result.bestEvidenceQuote!, provenance: p }] : [];
    const rejected = result.status !== "supported_by_pdd" && p ? [{ evidenceId: `audit:${result.ruleId}:rejected`, quote: result.bestEvidenceQuote!, rejectionReason: result.reasonSelected || result.assessmentReason, provenance: p }] : [];
    const applicability = result.status === "not_applicable" ? "NOT_APPLICABLE" : "APPLICABLE";
    const support = result.status === "supported_by_pdd" ? "SUPPORTED" : "NOT_SUPPORTED";
    const rowId = `quick-check:${record.auditId}:${result.ruleId}`;
    rows.push({
      rowId,
      requirement: { requirementId: result.stableId || result.ruleId, requirementReference: result.ruleId, requirementText: result.title || result.ruleLogic },
      methodology: { methodologyId: record.loadedRulebookId, rulebookVersion: record.loadedRulebookVersion },
      upstreamStatus: result.status === "supported_by_pdd" ? "FOUND" : result.status === "not_applicable" ? "MISSING" : result.status === "missing_evidence" ? "MISSING" : "UNCLEAR",
      applicabilityState: applicability,
      acceptedEvidence: accepted,
      rejectedEvidence: rejected,
      assessmentReason: result.assessmentReason || result.reasonSelected,
      clientAction: result.clientAction || null,
      searchCoverage: { searched: true, searchedDocumentIds: [sourceDocument.documentId], notes: null },
      sourceDocument,
      evidenceProvenance: p ? [p] : [],
      finalizationState: "finalized",
      finalizationActorRef: `quick-check-audit:${record.auditId}`,
      finalizedAt: record.generatedAt,
      finalizationBasis: "Finalized from the successful VM0007 Quick Check audit output.",
      reviewHistoryRef: `quick-check-audit:${record.auditId}`,
      evidenceMapContractVersion: "v1",
      reviewPolicyVersion: "policy-v1",
    });
    assessments.push({
      evidenceMapRowId: rowId,
      applicability: { decision: applicability, decisionBasis: result.assessmentReason || result.reasonSelected },
      conformance: { requirementSupport: support, searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" },
      draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
      reviewState: "PENDING_REVIEW",
    });
  }
  return { rows, assessments };
}

export function buildAndSaveQuickCheckReadinessPayload(record: Vm0007GapReportAuditRecord): void {
  const built = buildRows(record);
  finalizeEvidenceMapForReadiness({
    ...built,
    storageScope: {
      id: record.auditId,
      save: (gateResult) => saveQuickCheckReadinessPayload({ auditId: record.auditId, auditGeneratedAt: record.generatedAt, gateResult }),
      clear: () => { clearQuickCheckReadinessPayload(record.auditId); },
    },
  });
}
