import type { RuleSummary } from "@/app/m/_lib/methodRules";
import {
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import type { MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import type { EvidenceMapSourceDocumentIdentity } from "@/lib/evidence/evidenceMapDependencyContract";
import { type DraftBuildResult, type Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import { buildVm0007MachineProposal } from "@/lib/preverif/vm0007MachineProposal";
import {
  classifyEvidenceMapGenerationError,
  type EvidenceMapGenerationError,
} from "@/lib/preverif/evidenceMapGenerationError";
import {
  VM0007_GAP_REPORT_AUDIT_PREFIX,
  writeVm0007Storage,
} from "@/lib/preverif/vm0007Storage";

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
  error?: EvidenceMapGenerationError;
};

const failedGeneration = (blockedBy: string[] = [], error?: EvidenceMapGenerationError): Vm0007EvidenceMapGenerationResult => ({
  auditSaved: false,
  draftBuilt: false,
  draftSaved: false,
  blockedBy,
  auditId: null,
  audit: null,
  ...(error ? { error } : { error: classifyEvidenceMapGenerationError({ blockedBy }) }),
});

export function completeVm0007EvidenceMapGeneration(input: {
  audit: Vm0007GapReportAuditRecord;
  auditSaved: boolean;
  draft: DraftBuildResult;
  saveDraft?: (draft: Vm0007EvidenceMapDraftPackage) => boolean;
  loadDraft?: (auditId: string) => Vm0007EvidenceMapDraftPackage | null;
}): Vm0007EvidenceMapGenerationResult {
  if (!input.auditSaved) return { ...failedGeneration(["audit_persistence_failed"]), auditId: input.audit.auditId, audit: input.audit };
  if (!input.draft.ok) return { auditSaved: true, draftBuilt: false, draftSaved: false, blockedBy: input.draft.blockedBy, auditId: input.audit.auditId, audit: input.audit, error: classifyEvidenceMapGenerationError({ blockedBy: input.draft.blockedBy }) };
  const saveDraft = input.saveDraft ?? saveVm0007EvidenceMapDraft;
  const loadDraft = input.loadDraft ?? loadVm0007EvidenceMapDraft;
  try {
    if (!saveDraft(input.draft.package)) {
      clearVm0007GapReportAudit(input.audit.auditId);
      return { ...failedGeneration(["draft_persistence_failed"]), auditSaved: true, draftBuilt: true, draftSaved: false, auditId: input.audit.auditId, audit: input.audit };
    }
    if (!loadDraft(input.audit.auditId)) {
      clearVm0007GapReportAudit(input.audit.auditId);
      return { ...failedGeneration(["draft_persistence_failed"]), auditSaved: true, draftBuilt: true, draftSaved: false, auditId: input.audit.auditId, audit: input.audit };
    }
  } catch (error) {
    clearVm0007GapReportAudit(input.audit.auditId);
    return {
      ...failedGeneration(["draft_persistence_failed"], classifyEvidenceMapGenerationError({ error })),
      auditSaved: true,
      draftBuilt: true,
      draftSaved: false,
      auditId: input.audit.auditId,
      audit: input.audit,
    };
  }
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
  writeVm0007Storage(storage, storageKey(record.auditId), JSON.stringify(record), record.auditId.trim());
}

export function clearVm0007GapReportAudit(auditId: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  storage.removeItem(storageKey(auditId));
  return true;
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
  sourcePdfSha256?: string | null;
  rawPddText: string;
  rules: readonly RuleSummary[];
  userAcceptedVersionWarning?: boolean;
}): Vm0007EvidenceMapGenerationResult {
  if (input.methodology.methodologyId.trim().toUpperCase() !== "VM0007") return failedGeneration(["methodology_id_mismatch"]);
  if (!input.rawPddText.trim()) return failedGeneration(["pdf_parse_failed"], classifyEvidenceMapGenerationError({ error: "PDF extraction returned no text" }));
  if (input.rules.length === 0) return failedGeneration(["malformed_audit_output"]);

  const auditId = createVm0007GapReportAuditId();
  let built: ReturnType<typeof buildVm0007MachineProposal>;
  try {
    built = buildVm0007MachineProposal({
      auditId,
      generatedAt: nowIso(),
      methodologyId: input.loadedRulebookId,
      methodologyVersion: input.loadedRulebookVersion,
      methodology: input.methodology,
      evidenceFileName: input.evidenceFileName,
      sourcePdfSha256: input.sourcePdfSha256,
      rawPddText: input.rawPddText,
      rules: input.rules,
      userAcceptedVersionWarning: input.userAcceptedVersionWarning,
    });
  } catch (error) {
    return failedGeneration(["generation_failed"], classifyEvidenceMapGenerationError({ error }));
  }

  const record: Vm0007GapReportAuditRecord = {
    auditId,
    methodologyId: input.loadedRulebookId.trim(),
    methodologyVersion: input.loadedRulebookVersion.trim(),
    loadedRulebookId: input.loadedRulebookId.trim(),
    loadedRulebookVersion: input.loadedRulebookVersion.trim(),
    methodology: built.methodology ?? input.methodology,
    generatedAt: built.draft.ok ? built.draft.package.generatedAt : nowIso(),
    evidenceFileName: input.evidenceFileName?.trim() || undefined,
    userAcceptedVersionWarning: input.userAcceptedVersionWarning,
    audit: built.audit,
    sourceDocument: built.sourceDocument,
  };
  let auditSaved = false;
  try {
    saveVm0007GapReportAudit(record);
    auditSaved = loadVm0007GapReportAudit(record.auditId) !== null;
  } catch (error) {
    return failedGeneration(["audit_persistence_failed"], classifyEvidenceMapGenerationError({ error }));
  }
  if (!auditSaved) return { ...failedGeneration(["audit_persistence_failed"]), auditId: record.auditId, audit: record };
  return completeVm0007EvidenceMapGeneration({ audit: record, auditSaved: true, draft: built.draft });
}
