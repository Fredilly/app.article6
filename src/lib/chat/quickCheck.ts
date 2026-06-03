import { buildRequirementCoverageRows, reconcileRequirement } from "@/app/m/_lib/requirementCoverage";
import {
  buildEvidenceInventory,
  coalesceEvidencePins,
  linkEvidencePinToRequirement,
  linkPddFragmentToRequirement,
  type EvidenceInventoryItem,
} from "@/lib/evidence/inventory";
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidenceAttachment, EvidencePin } from "@/lib/proofMap/types";
import {
  createReviewerArtifactContext,
  createVerifierRunBundle,
  persistVerifierRunBundle,
  readVerifierRunBundle,
} from "@/lib/verify/runState";

export type QuickCheckDraftStatus = "draft" | "checked";
export type QuickCheckSourceMode = "uploaded_file" | "saved_evidence" | "demo_evidence";

export type QuickCheckExtractionSignals = {
  parsedEvidenceCount: number;
  factCount: number;
  relevantFactCount: number;
  methodologyMentionCount: number;
  warningCount: number;
};

export type QuickCheckExtractionSnapshot = {
  documentType: string;
  extractedFacts: string[];
  methodologyMentions: string[];
  warnings: string[];
  signals: QuickCheckExtractionSignals;
  extractionConfidence?: number;
  recoveredLocally?: boolean;
};

export type QuickCheckDraft = {
  id: string;
  claimText: string;
  methodologyId: string;
  methodologyVersion: string;
  evidenceIds: string[];
  status: QuickCheckDraftStatus;
  matchedRequirementId?: string;
  matchedRequirementLabel?: string;
  result?: QuickCheckResult | null;
  resultId?: string;
  linkedRunId?: string;
  sourceMode?: QuickCheckSourceMode;
  evidenceFileName?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickCheckResultVerdict = "Supported" | "Partial" | "Needs review" | "Missing evidence";

export type QuickCheckResult = {
  id: string;
  claimText: string;
  requirementId: string;
  requirementLabel: string;
  verdict: QuickCheckResultVerdict;
  explanation: string;
  citations: string[];
  nextStepHint: string;
  matchConfidence?: number;
  unresolved?: string[];
  extraction?: QuickCheckExtractionSnapshot | null;
  sourceMode?: QuickCheckSourceMode;
  evidenceFileName?: string;
};

export type QuickCheckStagedUpload = {
  evidenceId: string;
  filename: string;
  mime: string;
  createdAt: string;
  attachment: EvidenceAttachment;
};

export type MethodologyMismatchConfirmation = {
  detectedMethodology: string;
  selectedMethodology: string;
  detectedVersion?: string;
  selectedVersion?: string;
  // debug-safe normalized values for comparison
  normalizedSelectedId?: string;
  normalizedSelectedVersion?: string;
  normalizedDetectedId?: string;
  normalizedDetectedVersion?: string;
};

export type DocumentParseStatus = "uploaded" | "parsing" | "parsed" | "parse_failed" | "stale";

export type DocumentParseState = {
  documentId: string;
  status: DocumentParseStatus;
  hasParsedText: boolean;
  errorMessage?: string;
  updatedAt: string;
  version: number;
  // separate fetch failure (e.g. pdf-extract request failed) from PDF parse/text status
  fetchFailed?: boolean;
  fetchErrorMessage?: string;
};

export type QuickCheckSession = {
  draft: QuickCheckDraft;
  result: QuickCheckResult | null;
  stagedUploads: QuickCheckStagedUpload[];
  documentParseStates?: Record<string, DocumentParseState>;
  methodologyMismatchConfirmation?: MethodologyMismatchConfirmation | null;
};

type QuickCheckRule = {
  id: string;
  title: string;
  snippet: string;
  text?: string;
  summary?: string;
  logic?: string;
  notes?: string;
  when?: string[];
  expectedEvidence?: string[];
  type?: string;
  tags: string[];
  sectionId?: string;
  anchor?: string;
  refs?: {
    primarySection?: string;
    sectionAnchor?: string;
    sectionStableId?: string;
    tools?: string[];
  };
  citations?: Array<{
    sectionId?: string;
    anchor?: string;
    label?: string;
  }>;
};

const QUICK_CHECK_STORAGE_KEY = "a6:quick-check:claim-first:v2";
const QUICK_CHECK_STORAGE_KEY_V1 = "a6:quick-check:claim-first:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${nowIso()}-${Math.random().toString(16).slice(2)}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getDocumentIdForStaged(upload: QuickCheckStagedUpload): string {
  const sha = (upload.attachment as Record<string, unknown> | undefined)?.sha256;
  if (typeof sha === "string" && sha.length > 8) return `sha256:${sha}`;
  return `local:${upload.evidenceId}`;
}

function createDefaultDocumentParseState(documentId: string): DocumentParseState {
  const ts = nowIso();
  return {
    documentId,
    status: "uploaded",
    hasParsedText: false,
    updatedAt: ts,
    version: 1,
    fetchFailed: false,
  };
}

function normalizeDocumentParseStates(raw: unknown): Record<string, DocumentParseState> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DocumentParseState> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const candidateStatus = r.status as DocumentParseStatus;
    const status: DocumentParseStatus =
      candidateStatus === "uploaded" ||
      candidateStatus === "parsing" ||
      candidateStatus === "parsed" ||
      candidateStatus === "parse_failed" ||
      candidateStatus === "stale"
        ? candidateStatus
        : "stale";
    out[k] = {
      documentId: typeof r.documentId === "string" ? r.documentId : k,
      status,
      hasParsedText: Boolean(r.hasParsedText),
      errorMessage: typeof r.errorMessage === "string" ? r.errorMessage : undefined,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : nowIso(),
      version: typeof r.version === "number" ? r.version : 1,
      fetchFailed: Boolean(r.fetchFailed),
      fetchErrorMessage: typeof r.fetchErrorMessage === "string" ? r.fetchErrorMessage : undefined,
    };
  }
  return out;
}

export function updateQuickCheckSessionForDocumentParse(
  session: QuickCheckSession,
  documentId: string,
  patch: Partial<Omit<DocumentParseState, "documentId">>,
): QuickCheckSession {
  const prev = session.documentParseStates?.[documentId] ?? createDefaultDocumentParseState(documentId);
  const nextState: DocumentParseState = {
    ...prev,
    ...patch,
    documentId,
    updatedAt: nowIso(),
  };
  return {
    ...session,
    documentParseStates: {
      ...(session.documentParseStates ?? {}),
      [documentId]: nextState,
    },
  };
}

export function normalizeMethodologyForCompare(raw: string | undefined | null): string {
  return (raw ?? "").trim().toUpperCase().replace(/[-_\s.]+/g, "");
}

function normalizeMethodologyMismatchConfirmation(raw: unknown): MethodologyMismatchConfirmation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.detectedMethodology !== "string" || !r.detectedMethodology.trim() || typeof r.selectedMethodology !== "string" || !r.selectedMethodology.trim()) {
    return null;
  }
  return {
    detectedMethodology: String(r.detectedMethodology),
    selectedMethodology: String(r.selectedMethodology),
    detectedVersion: typeof r.detectedVersion === "string" ? r.detectedVersion : undefined,
    selectedVersion: typeof r.selectedVersion === "string" ? r.selectedVersion : undefined,
    normalizedSelectedId: typeof r.normalizedSelectedId === "string" ? r.normalizedSelectedId : undefined,
    normalizedSelectedVersion: typeof r.normalizedSelectedVersion === "string" ? r.normalizedSelectedVersion : undefined,
    normalizedDetectedId: typeof r.normalizedDetectedId === "string" ? r.normalizedDetectedId : undefined,
    normalizedDetectedVersion: typeof r.normalizedDetectedVersion === "string" ? r.normalizedDetectedVersion : undefined,
  };
}

export function updateQuickCheckSessionForMethodologyMismatch(
  session: QuickCheckSession,
  confirmation: MethodologyMismatchConfirmation | null,
): QuickCheckSession {
  return {
    ...session,
    methodologyMismatchConfirmation: confirmation,
  };
}

export function createQuickCheckDraft(
  seed?: Partial<Pick<QuickCheckDraft, "methodologyId" | "methodologyVersion" | "claimText">>,
): QuickCheckDraft {
  const timestamp = nowIso();
  return {
    id: newId("quick-check"),
    claimText: seed?.claimText?.trim() ?? "",
    methodologyId: seed?.methodologyId?.trim() ?? "",
    methodologyVersion: seed?.methodologyVersion?.trim() ?? "",
    evidenceIds: [],
    status: "draft",
    result: null,
    sourceMode: undefined,
    evidenceFileName: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeSourceMode(value: unknown): QuickCheckSourceMode | undefined {
  if (value === "uploaded_file" || value === "saved_evidence" || value === "demo_evidence") return value;
  if (value === "demo") return "demo_evidence";
  return undefined;
}

function normalizeSignalCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeExtractionSignals(input: {
  extractedFacts: string[];
  methodologyMentions: string[];
  warnings: string[];
  rawSignals?: unknown;
}): QuickCheckExtractionSignals {
  const rawSignals =
    input.rawSignals && typeof input.rawSignals === "object"
      ? input.rawSignals as Record<string, unknown>
      : null;

  return {
    parsedEvidenceCount: normalizeSignalCount(rawSignals?.parsedEvidenceCount) || (input.extractedFacts.length || input.methodologyMentions.length ? 1 : 0),
    factCount: normalizeSignalCount(rawSignals?.factCount) || input.extractedFacts.length,
    relevantFactCount: normalizeSignalCount(rawSignals?.relevantFactCount) || input.extractedFacts.length,
    methodologyMentionCount: normalizeSignalCount(rawSignals?.methodologyMentionCount) || input.methodologyMentions.length,
    warningCount: normalizeSignalCount(rawSignals?.warningCount) || input.warnings.length,
  };
}

export function validateQuickCheckDraft(
  draft: QuickCheckDraft,
  options?: { stagedEvidenceCount?: number },
): string[] {
  const errors: string[] = [];
  const evidenceCount = draft.evidenceIds.length + (options?.stagedEvidenceCount ?? 0);
  if (!evidenceCount) {
    errors.push("Upload or select one evidence item.");
  }
  return errors;
}

function normalizeResult(raw: unknown): QuickCheckResult | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const rawExtraction = record.extraction;
  const extraction =
    rawExtraction && typeof rawExtraction === "object"
      ? (() => {
          const extractionRecord = rawExtraction as Record<string, unknown>;
          const extractedFacts = Array.isArray(extractionRecord.extractedFacts)
            ? (extractionRecord.extractedFacts as unknown[]).map((item) => String(item)).filter(Boolean)
            : [];
          const methodologyMentions = Array.isArray(extractionRecord.methodologyMentions)
            ? (extractionRecord.methodologyMentions as unknown[]).map((item) => String(item)).filter(Boolean)
            : [];
          const warnings = Array.isArray(extractionRecord.warnings)
            ? (extractionRecord.warnings as unknown[]).map((item) => String(item)).filter(Boolean)
            : [];
          return {
            documentType:
              typeof extractionRecord.documentType === "string"
                ? extractionRecord.documentType as string
              : "Unknown document",
            extractedFacts,
            methodologyMentions,
            warnings,
            signals: normalizeExtractionSignals({
              extractedFacts,
              methodologyMentions,
              warnings,
              rawSignals: extractionRecord.signals,
            }),
          };
        })()
      : null;
  return {
    id: typeof record.id === "string" ? record.id : newId("quick-result"),
    claimText: typeof record.claimText === "string" ? record.claimText : "",
    requirementId: typeof record.requirementId === "string" ? record.requirementId : "",
    requirementLabel: typeof record.requirementLabel === "string" ? record.requirementLabel : "",
    verdict:
      record.verdict === "Supported" ||
      record.verdict === "Partial" ||
      record.verdict === "Needs review" ||
      record.verdict === "Missing evidence"
        ? record.verdict
        : "Needs review",
    explanation: typeof record.explanation === "string" ? record.explanation : "",
    citations: Array.isArray(record.citations) ? record.citations.map((item) => String(item)).filter(Boolean) : [],
    nextStepHint: typeof record.nextStepHint === "string" ? record.nextStepHint : "",
    matchConfidence: typeof record.matchConfidence === "number" ? Math.max(0, Math.min(1, record.matchConfidence)) : undefined,
    unresolved: Array.isArray(record.unresolved) ? record.unresolved.map((item) => String(item)).filter(Boolean) : [],
    extraction,
    sourceMode: normalizeSourceMode(record.sourceMode),
    evidenceFileName: typeof record.evidenceFileName === "string" ? record.evidenceFileName : undefined,
  };
}

function normalizeStagedUploads(raw: unknown): QuickCheckStagedUpload[] {
  if (!Array.isArray(raw)) return [];
  const uploads: QuickCheckStagedUpload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const evidenceId = typeof record.evidenceId === "string" ? record.evidenceId : "";
    const attachment = record.attachment && typeof record.attachment === "object"
      ? (record.attachment as EvidenceAttachment)
      : null;
    if (!evidenceId || !attachment) continue;
    uploads.push({
      evidenceId,
      filename: typeof record.filename === "string" ? record.filename : attachment.filename,
      mime: typeof record.mime === "string" ? record.mime : attachment.mime,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : attachment.created_at,
      attachment,
    });
  }
  return uploads;
}

export function loadQuickCheckSession(
  seed?: Partial<Pick<QuickCheckDraft, "methodologyId" | "methodologyVersion" | "claimText">>,
): QuickCheckSession {
  const storage = getStorage();
  const fallback: QuickCheckSession = { draft: createQuickCheckDraft(seed), result: null, stagedUploads: [], documentParseStates: {}, methodologyMismatchConfirmation: null };
  if (!storage) return fallback;
  let raw = storage.getItem(QUICK_CHECK_STORAGE_KEY);
  let loadedFromV1 = false;
  if (!raw) {
    raw = storage.getItem(QUICK_CHECK_STORAGE_KEY_V1);
    loadedFromV1 = !!raw;
  }
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<QuickCheckSession> | null;
    const draft = parsed?.draft;
    if (!draft || typeof draft !== "object") return fallback;
    const normalizedResult = normalizeResult(parsed?.result);
    const normalizedStagedUploads = normalizeStagedUploads(parsed?.stagedUploads);
    const normalizedDocumentParseStates = normalizeDocumentParseStates(parsed?.documentParseStates);
    let documentParseStates = normalizedDocumentParseStates;
    let methodologyMismatchConfirmation = normalizeMethodologyMismatchConfirmation(parsed?.methodologyMismatchConfirmation);
    if (loadedFromV1 || Object.keys(normalizedDocumentParseStates).length === 0) {
      documentParseStates = {};
      for (const upload of normalizedStagedUploads) {
        const did = getDocumentIdForStaged(upload);
        documentParseStates[did] = {
          documentId: did,
          status: "stale",
          hasParsedText: false,
          errorMessage:
            "Document state may be stale (migrated from previous Quick Check session or app update). Reprocess or re-upload the document to establish parse status.",
          updatedAt: nowIso(),
          version: 1,
          fetchFailed: false,
        };
      }
      methodologyMismatchConfirmation = null;
    }
    const inferredSourceMode =
      normalizeSourceMode((draft as Record<string, unknown>).sourceMode) ??
      normalizeSourceMode((draft as Record<string, unknown>).inputSource) ??
      (normalizedStagedUploads.length ? "uploaded_file" : Array.isArray(draft.evidenceIds) && draft.evidenceIds.length ? "saved_evidence" : undefined);
    const inferredEvidenceFileName =
      typeof (draft as Record<string, unknown>).evidenceFileName === "string"
        ? (draft as Record<string, unknown>).evidenceFileName as string
        : normalizedStagedUploads[0]?.filename;
    const hasBadParseState = Object.values(documentParseStates).some(
      (s) => s.status === "parse_failed" || s.status === "stale",
    );
    const effectiveResult = hasBadParseState && normalizedStagedUploads.length > 0 ? null : normalizedResult;
    if (hasBadParseState && normalizedStagedUploads.length > 0) {
      methodologyMismatchConfirmation = null;
    }
    return {
      draft: {
        id: typeof draft.id === "string" ? draft.id : fallback.draft.id,
        claimText: typeof draft.claimText === "string" ? draft.claimText : fallback.draft.claimText,
        methodologyId: typeof draft.methodologyId === "string" ? draft.methodologyId : fallback.draft.methodologyId,
        methodologyVersion:
          typeof draft.methodologyVersion === "string" ? draft.methodologyVersion : fallback.draft.methodologyVersion,
        evidenceIds: Array.isArray(draft.evidenceIds) ? draft.evidenceIds.map((item) => String(item)).filter(Boolean) : [],
        status: draft.status === "checked" ? "checked" : "draft",
        matchedRequirementId: typeof draft.matchedRequirementId === "string" ? draft.matchedRequirementId : undefined,
        matchedRequirementLabel:
          typeof draft.matchedRequirementLabel === "string" ? draft.matchedRequirementLabel : undefined,
        result: normalizeResult(draft.result),
        resultId: typeof draft.resultId === "string" ? draft.resultId : undefined,
        linkedRunId: typeof draft.linkedRunId === "string" ? draft.linkedRunId : undefined,
        sourceMode: inferredSourceMode,
        evidenceFileName: inferredEvidenceFileName,
        createdAt: typeof draft.createdAt === "string" ? draft.createdAt : fallback.draft.createdAt,
        updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : fallback.draft.updatedAt,
      },
      result: effectiveResult,
      stagedUploads: normalizedStagedUploads,
      documentParseStates,
      methodologyMismatchConfirmation,
    };
  } catch {
    return fallback;
  }
}

export function saveQuickCheckSession(session: QuickCheckSession): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(QUICK_CHECK_STORAGE_KEY, JSON.stringify(session));
}

export function buildQuickCheckResult(input: {
  draft: QuickCheckDraft;
  rule: QuickCheckRule;
  inventoryItems: EvidenceInventoryItem[];
  unresolved?: string[];
  extraction?: QuickCheckExtractionSnapshot | null;
  sourceMode?: QuickCheckSourceMode;
  evidenceFileName?: string;
}): QuickCheckResult {
  const requirementId = input.draft.matchedRequirementId ?? input.rule.id;
  const requirementLabel = input.draft.matchedRequirementLabel?.trim() || `${requirementId} · ${input.rule.title}`;
  const linkedSelection = input.inventoryItems
    .filter((item) => input.draft.evidenceIds.includes(item.evidence_id))
    .map((item) => {
      if (item.kind === "pdd" && item.pdd_fragments?.length) {
        const fragment = item.pdd_fragments[0]!;
        return {
          ...item,
          link_state: "linked" as const,
          linked_requirement_ids: [requirementId],
          pdd_fragment_links: [{ fragment_id: fragment.fragment_id, rule_id: requirementId }],
        };
      }
      return {
        ...item,
        link_state: "linked" as const,
        linked_requirement_ids: [requirementId],
      };
    });

  const row =
    buildRequirementCoverageRows({
      rules: [input.rule],
      inventoryItems: linkedSelection,
    })[0] ?? null;

  const reconciliation = reconcileRequirement({
    linkedEvidence: row?.linkedEvidence ?? [],
    expectedEvidenceTypes: row?.expectedEvidenceTypes ?? [],
  });

  return {
    id: newId("quick-result"),
    claimText: input.draft.claimText,
    requirementId,
    requirementLabel,
    verdict: reconciliation.label,
    explanation: reconciliation.reason,
    citations: compactCitations(row),
    nextStepHint: quickCheckNextStepHint(reconciliation.status),
    unresolved: (input.unresolved ?? []).map((item) => item.trim()).filter(Boolean),
    extraction: input.extraction ?? null,
    sourceMode: input.sourceMode ?? input.draft.sourceMode,
    evidenceFileName: input.evidenceFileName ?? input.draft.evidenceFileName,
  };
}

function compactCitations(row: ReturnType<typeof buildRequirementCoverageRows>[number] | null): string[] {
  if (!row) return [];
  const chips = new Set<string>();
  if (row.provenance.primarySection?.trim()) chips.add(row.provenance.primarySection.trim());
  if (row.provenance.sectionId?.trim()) chips.add(row.provenance.sectionId.trim());
  if (row.provenance.sectionAnchor?.trim()) chips.add(`Anchor ${row.provenance.sectionAnchor.replace(/^#/, "").trim()}`);
  if (row.provenance.sectionStableId?.trim()) chips.add(row.provenance.sectionStableId.trim());
  for (const tool of row.provenance.tools ?? []) {
    if (tool.trim()) chips.add(tool.trim());
  }
  for (const citation of row.provenance.citations ?? []) {
    if (citation.label?.trim()) chips.add(citation.label.trim());
    else if (citation.sectionId?.trim()) chips.add(citation.sectionId.trim());
  }
  return Array.from(chips).slice(0, 6);
}

function quickCheckNextStepHint(status: "supported" | "partial" | "needs-review" | "missing-evidence"): string {
  if (status === "supported") return "Open full review to preserve this check.";
  if (status === "partial") return "Open full review to close the gap.";
  if (status === "missing-evidence") return "Upload stronger evidence.";
  return "Open full review to continue.";
}

export function buildQuickCheckWorkspaceUrl(
  methodCode: string,
  version: string,
  ruleId: string,
  sourceMode?: QuickCheckSourceMode,
): string {
  const params = new URLSearchParams({
    tab: "verify",
    mode: "list",
    rule: ruleId,
  });
  if (sourceMode) params.set("quickCheckSource", sourceMode);
  return `/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}?${params.toString()}`;
}

export function ensureQuickCheckWorkspaceHandoff(draft: QuickCheckDraft): { draft: QuickCheckDraft; url: string } {
  const methodCode = draft.methodologyId.trim();
  const version = draft.methodologyVersion.trim();
  const ruleId = draft.matchedRequirementId?.trim() ?? "";
  const currentPins = coalesceEvidencePins(loadPins(methodCode, version));

  let nextPins: EvidencePin[] = currentPins;
  for (const evidenceId of draft.evidenceIds) {
    const pin = nextPins.find((item) => item.id === evidenceId);
    if (!pin || !ruleId) continue;
    if (pin.kind === "pdd" && pin.pdd_fragments?.length) {
      const fragmentId = pin.pdd_fragments[0]?.fragment_id;
      if (fragmentId) {
        nextPins = linkPddFragmentToRequirement(nextPins, evidenceId, fragmentId, ruleId);
        continue;
      }
    }
    nextPins = linkEvidencePinToRequirement(nextPins, evidenceId, ruleId);
  }
  savePins(methodCode, version, coalesceEvidencePins(nextPins));

  const existingBundle = readVerifierRunBundle(methodCode, version);
  const linkedRunId = draft.linkedRunId?.trim();
  const seedBundle = createVerifierRunBundle(methodCode, version);
  const runId = linkedRunId || seedBundle.runContext.runId;
  const createdAt =
    linkedRunId && existingBundle.runContext.runId === linkedRunId
      ? existingBundle.runContext.createdAt
      : seedBundle.runContext.createdAt;
  const reviewerContext = createReviewerArtifactContext({ methodCode, version, ruleId, runId });

  if (
    existingBundle.runContext.runId !== runId ||
    existingBundle.reviewerContext.ruleId !== ruleId ||
    existingBundle.reviewerContext.methodCode !== reviewerContext.methodCode ||
    existingBundle.reviewerContext.version !== reviewerContext.version
  ) {
    persistVerifierRunBundle(methodCode, version, {
      ...seedBundle,
      runContext: { runId, createdAt },
      reviewerContext,
      savedReviewerArtifactContext: null,
      loadedFromRunId: null,
      derivedFromRunId: null,
      isEditedDraft: false,
    });
  }

  const nextDraft: QuickCheckDraft = {
    ...draft,
    linkedRunId: runId,
    status: "checked",
    updatedAt: nowIso(),
  };
  return {
    draft: nextDraft,
    url: buildQuickCheckWorkspaceUrl(methodCode, version, ruleId, draft.sourceMode),
  };
}

export function loadQuickCheckInventory(methodCode: string, version: string): EvidenceInventoryItem[] {
  if (!methodCode.trim() || !version.trim()) return [];
  return buildEvidenceInventory(loadPins(methodCode, version));
}
