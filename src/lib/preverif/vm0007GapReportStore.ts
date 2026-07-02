import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  type MethodologyEvidenceAuditRule,
  type MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";
import {
  getVm0007EvidenceContract,
  normalizeVm0007RuleId,
} from "@/lib/preverif/vm0007EvidenceContracts";

const VM0007_GAP_REPORT_AUDIT_PREFIX = "a6:vm0007-gap-report-audit:v1:";

export type Vm0007GapReportAuditRecord = {
  auditId: string;
  methodologyId: string;
  methodologyVersion: string;
  generatedAt: string;
  evidenceFileName?: string;
  audit: MethodologyEvidenceAuditSummary;
};

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
    return parsed;
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
  methodologyId: string;
  methodologyVersion: string;
  evidenceFileName?: string;
  rawPddText: string;
  rules: readonly RuleSummary[];
}): Vm0007GapReportAuditRecord | null {
  if (input.methodologyId.trim().toUpperCase() !== "VM0007") return null;
  if (!input.rawPddText.trim() || input.rules.length === 0) return null;

  const context = getStructuredQueryContext(input.rawPddText);
  const audit = auditEvidence({
    rules: input.rules.map(mapRule),
    evidenceDocument: context.evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText: input.rawPddText,
  });

  const record: Vm0007GapReportAuditRecord = {
    auditId: createVm0007GapReportAuditId(),
    methodologyId: input.methodologyId.trim(),
    methodologyVersion: input.methodologyVersion.trim(),
    generatedAt: nowIso(),
    evidenceFileName: input.evidenceFileName?.trim() || undefined,
    audit,
  };
  saveVm0007GapReportAudit(record);
  return record;
}
