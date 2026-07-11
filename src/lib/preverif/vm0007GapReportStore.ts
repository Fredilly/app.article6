import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { parseExtractedText } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";
import {
  buildQuickCheckMethodologyIdentity,
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import {
  auditEvidence,
  type MethodologyEvidenceAuditRule,
  type MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";
import {
  getVm0007EvidenceContract,
  normalizeVm0007RuleId,
} from "@/lib/preverif/vm0007EvidenceContracts";
import type { EvidenceMapSourceDocumentIdentity } from "@/lib/evidence/evidenceMapDependencyContract";
import { buildVm0007EvidenceMapDraft, type DraftBuildResult, type Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";

const VM0007_GAP_REPORT_AUDIT_PREFIX = "a6:vm0007-gap-report-audit:v1:";

export type Vm0007GapReportAuditRecord = {
  auditId: string;
  methodologyId: string;
  methodologyVersion: string;
  loadedRulebookId: string;
  loadedRulebookVersion: string;
  methodology: QuickCheckMethodologyIdentity | null;
  generatedAt: string;
  evidenceFileName?: string;
  userAcceptedVersionWarning?: boolean;
  audit: MethodologyEvidenceAuditSummary;
  sourceDocument?: EvidenceMapSourceDocumentIdentity;
};

export type Vm0007EvidenceMapGenerationResult = {
  auditSaved: boolean;
  draftBuilt: boolean;
  draftSaved: boolean;
  blockedBy: string[];
  auditId: string | null;
  audit: Vm0007GapReportAuditRecord | null;
};

const failedGeneration = (blockedBy: string[] = []): Vm0007EvidenceMapGenerationResult => ({
  auditSaved: false,
  draftBuilt: false,
  draftSaved: false,
  blockedBy,
  auditId: null,
  audit: null,
});

export function completeVm0007EvidenceMapGeneration(input: {
  audit: Vm0007GapReportAuditRecord;
  auditSaved: boolean;
  draft: DraftBuildResult;
  saveDraft?: (draft: Vm0007EvidenceMapDraftPackage) => boolean;
  loadDraft?: (auditId: string) => Vm0007EvidenceMapDraftPackage | null;
}): Vm0007EvidenceMapGenerationResult {
  if (!input.auditSaved) return { ...failedGeneration(["audit_persistence_failed"]), auditId: input.audit.auditId, audit: input.audit };
  if (!input.draft.ok) return { auditSaved: true, draftBuilt: false, draftSaved: false, blockedBy: input.draft.blockedBy, auditId: input.audit.auditId, audit: input.audit };
  const saveDraft = input.saveDraft ?? saveVm0007EvidenceMapDraft;
  const loadDraft = input.loadDraft ?? loadVm0007EvidenceMapDraft;
  if (!saveDraft(input.draft.package)) return { auditSaved: true, draftBuilt: true, draftSaved: false, blockedBy: ["draft_persistence_failed"], auditId: input.audit.auditId, audit: input.audit };
  if (!loadDraft(input.audit.auditId)) return { auditSaved: true, draftBuilt: true, draftSaved: false, blockedBy: ["draft_persistence_failed"], auditId: input.audit.auditId, audit: input.audit };
  return { auditSaved: true, draftBuilt: true, draftSaved: true, blockedBy: [], auditId: input.audit.auditId, audit: input.audit };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function storageKey(auditId: string): string {
  return `${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId.trim()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapRule(rule: RuleSummary): MethodologyEvidenceAuditRule {
  return {
    id: rule.id,
    title: rule.title,
    summary: rule.summary ?? rule.snippet,
    type: rule.type,
    logic: rule.logic,
    text: rule.text,
  };
}

export function createVm0007GapReportAuditId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `vm0007-gap-${crypto.randomUUID()}`;
  }
  return `vm0007-gap-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildVm0007GapReportHref(auditId: string): string {
  return `/internal/reports/vm0007-gap/${encodeURIComponent(auditId)}`;
}

export function saveVm0007GapReportAudit(record: Vm0007GapReportAuditRecord): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(storageKey(record.auditId), JSON.stringify(record));
}

export function loadVm0007GapReportAudit(auditId: string): Vm0007GapReportAuditRecord | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(storageKey(auditId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Vm0007GapReportAuditRecord;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.auditId !== "string" || typeof parsed.methodologyId !== "string" || typeof parsed.methodologyVersion !== "string") {
      return null;
    }
    if (!parsed.audit || !Array.isArray(parsed.audit.results) || typeof parsed.audit.totalRules !== "number") return null;
    return {
      ...parsed,
      loadedRulebookId: typeof parsed.loadedRulebookId === "string" ? parsed.loadedRulebookId : parsed.methodologyId,
      loadedRulebookVersion: typeof parsed.loadedRulebookVersion === "string" ? parsed.loadedRulebookVersion : parsed.methodologyVersion,
      methodology: parsed.methodology ?? null,
      sourceDocument: parsed.sourceDocument ?? { documentId: parsed.evidenceFileName || parsed.auditId, documentName: parsed.evidenceFileName || null, contentSha256: null },
    };
  } catch {
    return null;
  }
}

export function hasVm0007GapReportAudit(auditId: string | null | undefined): boolean {
  if (!auditId?.trim()) return false;
  return loadVm0007GapReportAudit(auditId) !== null;
}

export function deriveVm0007ProjectName(evidenceFileName?: string): string {
  const trimmed = evidenceFileName?.trim() ?? "";
  if (!trimmed) return "VM0007 project";
  const stem = trimmed.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem || "VM0007 project";
}

export function buildAndSaveVm0007GapReportAudit(input: {
  methodology: QuickCheckMethodologyIdentity;
  loadedRulebookId: string;
  loadedRulebookVersion: string;
  evidenceFileName?: string;
  rawPddText: string;
  rules: readonly RuleSummary[];
  userAcceptedVersionWarning?: boolean;
}): Vm0007EvidenceMapGenerationResult {
  if (input.methodology.methodologyId.trim().toUpperCase() !== "VM0007") return failedGeneration(["methodology_id_mismatch"]);
  if (!input.rawPddText.trim() || input.rules.length === 0) return failedGeneration(["malformed_audit_output"]);

  const context = getStructuredQueryContext(input.rawPddText);
  const parsedDocument = parseExtractedText(
    input.rawPddText,
    context.evidenceDocument.docId,
    context.parsedDocument.adapterId ?? "quick-check-panel",
  );
  const methodologyResult = validateAnswerResults(
    extractAnswersForAllChecks(parsedDocument),
  ).find((result) => result.checkName === "methodology");
  const methodology = methodologyResult?.methodology ?? buildQuickCheckMethodologyIdentity(methodologyResult?.evidence ?? null) ?? input.methodology;
  const audit = auditEvidence({
    rules: input.rules.map(mapRule),
    evidenceDocument: context.evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText: input.rawPddText,
    versionContext: {
      methodologyId: input.loadedRulebookId,
      rulebookVersion: input.loadedRulebookVersion,
      pddDeclaredMethodologyVersion: methodology.pddDeclaredMethodologyVersion ?? "",
    },
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
  });

  const record: Vm0007GapReportAuditRecord = {
    auditId: createVm0007GapReportAuditId(),
    methodologyId: input.loadedRulebookId.trim(),
    methodologyVersion: input.loadedRulebookVersion.trim(),
    loadedRulebookId: input.loadedRulebookId.trim(),
    loadedRulebookVersion: input.loadedRulebookVersion.trim(),
    methodology,
    generatedAt: nowIso(),
    evidenceFileName: input.evidenceFileName?.trim() || undefined,
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
    audit,
    sourceDocument: { documentId: context.evidenceDocument.docId, documentName: input.evidenceFileName?.trim() || null, contentSha256: null },
  };
  saveVm0007GapReportAudit(record);
  const auditSaved = loadVm0007GapReportAudit(record.auditId) !== null;
  if (!auditSaved) return { ...failedGeneration(["audit_persistence_failed"]), auditId: record.auditId, audit: record };
  const draft = buildVm0007EvidenceMapDraft({
    auditId: record.auditId,
    generatedAt: record.generatedAt,
    rules: input.rules,
    audit,
    sourceDocument: record.sourceDocument,
  });
  return completeVm0007EvidenceMapGeneration({ audit: record, auditSaved: true, draft });
}
