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
import { EVIDENCE_AUDIT_STATUSES } from "@/lib/preverif/evidenceAudit";
import { normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";

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

const DRAFT_EVIDENCE_STATUSES = ["FOUND", "UNCLEAR", "MISSING"] as const;
const DRAFT_APPLICABILITY_STATES = ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] as const;
const DRAFT_ROW_KEYS = new Set([
  "rowId", "auditId", "stableRuleId", "ruleReference", "ruleTitle", "requirementText",
  "methodologyId", "methodologyVersion", "rawAuditStatus", "upstreamStatus",
  "proposedEvidenceStatus", "proposedApplicability", "proposedAcceptedEvidence",
  "proposedRejectedEvidence", "assessmentReason", "gap", "clientAction", "confidence",
  "searchCoverage", "sourceDocument", "quote", "page", "section", "spanId", "provenance",
  "finalizationState", "proposalSource", "proposalTimestamp",
]);
const DRAFT_PACKAGE_KEYS = new Set(["auditId", "generatedAt", "methodologyId", "rulebookVersion", "pddDeclaredMethodologyVersion", "sourceDocument", "proposalState", "rows", "blockedBy", "contractVersion"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNullableText(value: unknown): value is string | null {
  return value === null || hasText(value);
}

function isKnownAuditStatus(value: unknown): value is EvidenceAuditStatus {
  return typeof value === "string" && (EVIDENCE_AUDIT_STATUSES as readonly string[]).includes(value);
}

function isProvenance(value: unknown): value is EvidenceMapEvidenceProvenance {
  return isRecord(value) && hasText(value.docId) && (value.page === null || (typeof value.page === "number" && Number.isFinite(value.page))) &&
    Array.isArray(value.sectionPath) && value.sectionPath.every((entry) => hasText(entry)) && hasText(value.spanId) &&
    hasNullableText(value.sectionHeading) && hasNullableText(value.sourceType);
}

function isSourceDocument(value: unknown): value is EvidenceMapSourceDocumentIdentity {
  return isRecord(value) && hasText(value.documentId) && hasNullableText(value.documentName) && hasNullableText(value.contentSha256);
}

function isSearchCoverage(value: unknown): value is EvidenceMapSearchCoverage {
  return isRecord(value) && typeof value.searched === "boolean" && Array.isArray(value.searchedDocumentIds) &&
    value.searchedDocumentIds.length > 0 && value.searchedDocumentIds.every((entry) => hasText(entry)) && hasNullableText(value.notes);
}

function isEvidence(value: unknown, rejected: boolean): boolean {
  if (!isRecord(value) || !hasText(value.quote) || !isProvenance(value.provenance)) return false;
  return !rejected || hasText(value.reason);
}

function isExplicitNotApplicableScopeBasis(reason: unknown): reason is string {
  if (!hasText(reason)) return false;
  const normalized = reason.toLowerCase();
  return /\b(not applicable|does not apply|outside (?:the )?scope|out of scope|excluded from (?:the )?scope|not within (?:the )?scope)\b/.test(normalized);
}

function exhaustiveDraftStatus(status: never): never {
  return status;
}

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
  switch (status) {
    case "supported_by_pdd":
      return { upstreamStatus: "FOUND" as const, proposedApplicability: "APPLICABLE" as const, accepted: provenance ? { quote: result.bestEvidenceQuote!.trim(), provenance } : null, rejected: null };
    case "partially_supported":
      return { upstreamStatus: "UNCLEAR" as const, proposedApplicability: "APPLICABLE" as const, accepted: provenance ? { quote: result.bestEvidenceQuote!.trim(), provenance } : null, rejected: null };
    case "missing_evidence":
      return { upstreamStatus: "MISSING" as const, proposedApplicability: "APPLICABLE" as const, accepted: null, rejected: null };
    case "manual_review_needed":
      return { upstreamStatus: "UNCLEAR" as const, proposedApplicability: "UNKNOWN" as const, accepted: null, rejected: provenance ? { quote: result.bestEvidenceQuote!.trim(), reason: result.assessmentReason || result.gap, provenance } : null };
    case "not_applicable": {
      const explicitlyScoped = Boolean(provenance && isExplicitNotApplicableScopeBasis(result.assessmentReason));
      return { upstreamStatus: "UNCLEAR" as const, proposedApplicability: explicitlyScoped ? "NOT_APPLICABLE" as const : "UNKNOWN" as const, accepted: explicitlyScoped ? { quote: result.bestEvidenceQuote!.trim(), provenance: provenance! } : null, rejected: null };
    }
    default:
      return exhaustiveDraftStatus(status);
  }
}

/** Pure runtime validation for the draft persistence boundary. */
export function validateVm0007EvidenceMapDraftPackage(value: unknown, expectedAuditId?: string): value is Vm0007EvidenceMapDraftPackage {
  if (!isRecord(value) || Object.keys(value).some((key) => !DRAFT_PACKAGE_KEYS.has(key)) || value.contractVersion !== VM0007_EVIDENCE_MAP_DRAFT_CONTRACT_VERSION || value.proposalState !== VM0007_EVIDENCE_MAP_DRAFT_PROPOSAL_STATE ||
    value.methodologyId !== "VM0007" || value.rulebookVersion !== "v1.8" || normalizeMethodologyVersion(String(value.pddDeclaredMethodologyVersion ?? "")) !== "v1.8" ||
    !hasText(value.auditId) || (expectedAuditId !== undefined && value.auditId !== expectedAuditId) || !hasText(value.generatedAt) ||
    !isSourceDocument(value.sourceDocument) || !Array.isArray(value.rows) || value.rows.length !== 58 || !Array.isArray(value.blockedBy) ||
    !value.blockedBy.every((reason) => hasText(reason))) return false;

  const ruleIds = new Set<string>();
  const stableRuleIds = new Set<string>();
  const rowIds = new Set<string>();
  for (const row of value.rows) {
    if (!isRecord(row) || Object.keys(row).some((key) => !DRAFT_ROW_KEYS.has(key)) || !hasText(row.rowId) || rowIds.has(row.rowId) || !hasText(row.auditId) || row.auditId !== value.auditId ||
      !hasText(row.stableRuleId) || stableRuleIds.has(row.stableRuleId) || !hasText(row.ruleReference) || ruleIds.has(row.ruleReference) || !hasText(row.ruleTitle) || !hasText(row.requirementText) ||
      row.methodologyId !== "VM0007" || row.methodologyVersion !== "v1.8" || !isKnownAuditStatus(row.rawAuditStatus) ||
      !(DRAFT_EVIDENCE_STATUSES as readonly string[]).includes(String(row.upstreamStatus)) || !(DRAFT_EVIDENCE_STATUSES as readonly string[]).includes(String(row.proposedEvidenceStatus)) ||
      !(DRAFT_APPLICABILITY_STATES as readonly string[]).includes(String(row.proposedApplicability)) || !hasText(row.assessmentReason) || typeof row.gap !== "string" || !hasText(row.clientAction) ||
      !["high", "medium", "low"].includes(String(row.confidence)) || !isSearchCoverage(row.searchCoverage) || !isSourceDocument(row.sourceDocument) ||
      row.finalizationState !== "draft" || row.proposalSource !== "VM0007_QUICK_CHECK_AUDIT" || !hasText(row.proposalTimestamp) ||
      (row.quote !== null && !hasText(row.quote)) || (row.page !== null && (typeof row.page !== "number" || !Number.isFinite(row.page))) ||
      !hasNullableText(row.section) || !hasNullableText(row.spanId) || (row.provenance !== null && !isProvenance(row.provenance)) ||
      (row.proposedAcceptedEvidence !== null && !isEvidence(row.proposedAcceptedEvidence, false)) || (row.proposedRejectedEvidence !== null && !isEvidence(row.proposedRejectedEvidence, true))) return false;
    rowIds.add(row.rowId);
    ruleIds.add(row.ruleReference);
    stableRuleIds.add(row.stableRuleId);
    if (row.sourceDocument.documentId !== value.sourceDocument.documentId || !row.searchCoverage.searchedDocumentIds.includes(value.sourceDocument.documentId)) return false;
    if (row.provenance && row.provenance.docId !== row.sourceDocument.documentId) return false;
  }
  return true;
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
  const canonicalIds = input.rules.map((rule) => typeof rule.id === "string" ? normalizeVm0007RuleId(rule.id) : "");
  const resultIds = input.audit.results.map((result) => typeof result?.ruleId === "string" ? normalizeVm0007RuleId(result.ruleId) : "");
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
  if (input.audit.results.some((result) => !isKnownAuditStatus(result?.status))) blockedBy.push("unknown_audit_status");
  if (blockedBy.length || !sourceDocument) return { ok: false, blockedBy: Array.from(new Set(blockedBy)) };

  const results = new Map(input.audit.results.map((result) => [normalizeVm0007RuleId(result.ruleId), result]));
  const rows = input.rules.map((rule) => {
    const result = results.get(normalizeVm0007RuleId(rule.id))!;
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
