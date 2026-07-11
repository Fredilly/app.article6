import { normalizeMethodologyVersion } from "@/lib/chat/methodologyVersion";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import type {
  EvidenceMapEvidenceProvenance,
  EvidenceMapSearchCoverage,
  EvidenceMapSourceDocumentIdentity,
} from "@/lib/evidence/evidenceMapDependencyContract";
import type {
  EvidenceAuditStatus,
  MethodologyEvidenceAuditResult,
  MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";

export const VM0007_EVIDENCE_MAP_DRAFT_CONTRACT_VERSION = "vm0007-evidence-map-draft-v1";
export const VM0007_EVIDENCE_MAP_DRAFT_PROPOSAL_STATE = "MACHINE_PROPOSED" as const;

export type DraftApplicability = "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
export type DraftEvidenceStatus = "FOUND" | "UNCLEAR" | "MISSING";

export type Vm0007EvidenceMapDraftRow = {
  rowId: string;
  auditId: string;
  stableRuleId: string;
  ruleReference: string;
  ruleTitle: string;
  requirementText: string;
  methodologyId: string;
  methodologyVersion: string;
  rawAuditStatus: EvidenceAuditStatus;
  upstreamStatus: DraftEvidenceStatus;
  proposedEvidenceStatus: DraftEvidenceStatus;
  proposedApplicability: DraftApplicability;
  proposedAcceptedEvidence: { quote: string; provenance: EvidenceMapEvidenceProvenance } | null;
  proposedRejectedEvidence: { quote: string; reason: string; provenance: EvidenceMapEvidenceProvenance } | null;
  assessmentReason: string;
  gap: string;
  clientAction: string;
  confidence: MethodologyEvidenceAuditResult["confidence"];
  searchCoverage: EvidenceMapSearchCoverage;
  sourceDocument: EvidenceMapSourceDocumentIdentity;
  quote: string | null;
  page: number | null;
  section: string | null;
  spanId: string | null;
  provenance: EvidenceMapEvidenceProvenance | null;
  finalizationState: "draft";
  proposalSource: "VM0007_QUICK_CHECK_AUDIT";
  proposalTimestamp: string;
};

export type Vm0007EvidenceMapDraftPackage = {
  auditId: string;
  generatedAt: string;
  methodologyId: "VM0007";
  rulebookVersion: "v1.8";
  pddDeclaredMethodologyVersion: string;
  sourceDocument: EvidenceMapSourceDocumentIdentity;
  proposalState: typeof VM0007_EVIDENCE_MAP_DRAFT_PROPOSAL_STATE;
  rows: Vm0007EvidenceMapDraftRow[];
  blockedBy: string[];
  contractVersion: typeof VM0007_EVIDENCE_MAP_DRAFT_CONTRACT_VERSION;
};

export type DraftBuildResult =
  | { ok: true; package: Vm0007EvidenceMapDraftPackage }
  | { ok: false; blockedBy: string[] };

function provenanceFor(result: MethodologyEvidenceAuditResult, sourceDocument: EvidenceMapSourceDocumentIdentity): EvidenceMapEvidenceProvenance | null {
  if (!result.bestEvidenceQuote?.trim() || !result.span?.trim() || !sourceDocument.documentId.trim()) return null;
  return {
    docId: sourceDocument.documentId,
    page: result.page,
    sectionPath: result.section ? [result.section] : [],
    spanId: result.span,
    sectionHeading: result.section,
    sourceType: "PDD",
  };
}

export function mapVm0007DraftStatus(status: EvidenceAuditStatus, result: MethodologyEvidenceAuditResult, sourceDocument: EvidenceMapSourceDocumentIdentity) {
  const provenance = provenanceFor(result, sourceDocument);
  if (status === "supported_by_pdd") return {
    upstreamStatus: "FOUND" as const,
    proposedApplicability: "APPLICABLE" as const,
    accepted: provenance ? { quote: result.bestEvidenceQuote!.trim(), provenance } : null,
    rejected: null,
  };
  if (status === "partially_supported") return {
    upstreamStatus: "UNCLEAR" as const,
    proposedApplicability: "APPLICABLE" as const,
    accepted: provenance ? { quote: result.bestEvidenceQuote!.trim(), provenance } : null,
    rejected: null,
  };
  if (status === "missing_evidence") return {
    upstreamStatus: "MISSING" as const,
    proposedApplicability: "APPLICABLE" as const,
    accepted: null,
    rejected: null,
  };
  if (status === "manual_review_needed") return {
    upstreamStatus: "UNCLEAR" as const,
    proposedApplicability: provenance ? "APPLICABLE" as const : "UNKNOWN" as const,
    accepted: null,
    rejected: provenance ? { quote: result.bestEvidenceQuote!.trim(), reason: result.assessmentReason || result.gap, provenance } : null,
  };
  return {
    upstreamStatus: "UNCLEAR" as const,
    proposedApplicability: provenance ? "NOT_APPLICABLE" as const : "UNKNOWN" as const,
    accepted: provenance ? { quote: result.bestEvidenceQuote!.trim(), provenance } : null,
    rejected: null,
  };
}

export function buildVm0007EvidenceMapDraft(input: {
  auditId: string;
  generatedAt: string;
  rules: readonly RuleSummary[];
  audit: MethodologyEvidenceAuditSummary;
  sourceDocument?: EvidenceMapSourceDocumentIdentity | null;
}): DraftBuildResult {
  const blockedBy: string[] = [];
  if (!Array.isArray(input.rules) || !input.audit || !Array.isArray(input.audit.results)) {
    return { ok: false, blockedBy: ["malformed_audit_output"] };
  }
  const methodologyId = (input.audit.methodologyId ?? "").trim().toUpperCase();
  const rulebookVersion = normalizeMethodologyVersion(input.audit.rulebookVersion ?? "");
  const declaredVersion = normalizeMethodologyVersion(input.audit.pddDeclaredMethodologyVersion ?? "");
  const sourceDocument = input.sourceDocument ?? null;
  const canonicalIds = input.rules.map((rule) => typeof rule.id === "string" ? rule.id.trim().toUpperCase() : "");
  const resultIds = input.audit.results.map((result) => typeof result?.ruleId === "string" ? result.ruleId.trim().toUpperCase() : "");
  if (canonicalIds.some((id) => !id)) blockedBy.push("malformed_rulebook");
  if (canonicalIds.some((id, index) => canonicalIds.indexOf(id) !== index)) blockedBy.push("duplicate_canonical_rule_ids");
  const duplicates = resultIds.filter((id, index) => resultIds.indexOf(id) !== index);
  const unknown = resultIds.filter((id) => !canonicalIds.includes(id));
  const missing = canonicalIds.filter((id) => !resultIds.includes(id));
  if (methodologyId !== "VM0007") blockedBy.push("methodology_id_mismatch");
  if (rulebookVersion !== "v1.8") blockedBy.push("rulebook_version_mismatch");
  if (declaredVersion !== "v1.8") blockedBy.push("pdd_declared_version_mismatch");
  if (input.audit.versionMatch !== true || input.audit.auditStatus !== "AUDITED") blockedBy.push("audit_not_successfully_audited");
  if (input.audit.totalRules !== input.rules.length) blockedBy.push("audit_total_rules_mismatch");
  if (input.rules.length !== 58) blockedBy.push("canonical_rule_count_is_not_58");
  if (duplicates.length) blockedBy.push("duplicate_rule_ids");
  if (missing.length) blockedBy.push("missing_rule_ids");
  if (unknown.length) blockedBy.push("unknown_rule_ids");
  if (!sourceDocument?.documentId?.trim()) blockedBy.push("missing_source_document_identity");
  if (!input.audit.results.every((result) => result && typeof result.ruleId === "string" && typeof result.status === "string")) blockedBy.push("malformed_audit_output");
  if (blockedBy.length || !sourceDocument) return { ok: false, blockedBy: Array.from(new Set(blockedBy)) };

  const results = new Map(input.audit.results.map((result) => [result.ruleId.trim().toUpperCase(), result]));
  const rows = input.rules.map((rule) => {
    const result = results.get(rule.id.trim().toUpperCase())!;
    const mapped = mapVm0007DraftStatus(result.status, result, sourceDocument);
    const provenance = mapped.accepted?.provenance ?? mapped.rejected?.provenance ?? null;
    return {
      rowId: `${input.auditId}:${rule.id}`,
      auditId: input.auditId,
      stableRuleId: result.stableId || rule.id,
      ruleReference: rule.id,
      ruleTitle: rule.title,
      requirementText: rule.text || rule.summary || rule.snippet,
      methodologyId: "VM0007",
      methodologyVersion: "v1.8",
      rawAuditStatus: result.status,
      upstreamStatus: mapped.upstreamStatus,
      proposedEvidenceStatus: mapped.upstreamStatus,
      proposedApplicability: mapped.proposedApplicability,
      proposedAcceptedEvidence: mapped.accepted,
      proposedRejectedEvidence: mapped.rejected,
      assessmentReason: result.assessmentReason,
      gap: result.gap,
      clientAction: result.clientAction,
      confidence: result.confidence,
      searchCoverage: { searched: true, searchedDocumentIds: [sourceDocument.documentId], notes: "VM0007 Quick Check audit search coverage." },
      sourceDocument,
      quote: result.bestEvidenceQuote,
      page: result.page,
      section: result.section,
      spanId: result.span,
      provenance,
      finalizationState: "draft" as const,
      proposalSource: "VM0007_QUICK_CHECK_AUDIT" as const,
      proposalTimestamp: input.generatedAt,
    } satisfies Vm0007EvidenceMapDraftRow;
  });
  return { ok: true, package: { auditId: input.auditId, generatedAt: input.generatedAt, methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: declaredVersion!, sourceDocument, proposalState: VM0007_EVIDENCE_MAP_DRAFT_PROPOSAL_STATE, rows, blockedBy: [], contractVersion: VM0007_EVIDENCE_MAP_DRAFT_CONTRACT_VERSION } };
}
