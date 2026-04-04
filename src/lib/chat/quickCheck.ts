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
};

export type QuickCheckStagedUpload = {
  evidenceId: string;
  filename: string;
  mime: string;
  createdAt: string;
  attachment: EvidenceAttachment;
};

type QuickCheckSession = {
  draft: QuickCheckDraft;
  result: QuickCheckResult | null;
  stagedUploads: QuickCheckStagedUpload[];
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

const QUICK_CHECK_STORAGE_KEY = "a6:quick-check:claim-first:v1";

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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateQuickCheckDraft(
  draft: QuickCheckDraft,
  options?: { stagedEvidenceCount?: number },
): string[] {
  const errors: string[] = [];
  if (!draft.claimText.trim()) {
    errors.push("Enter a claim to check.");
  }
  const evidenceCount = draft.evidenceIds.length + (options?.stagedEvidenceCount ?? 0);
  if (!evidenceCount) {
    errors.push("Upload or select one evidence item.");
  }
  return errors;
}

function normalizeResult(raw: unknown): QuickCheckResult | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
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
  const fallback = { draft: createQuickCheckDraft(seed), result: null, stagedUploads: [] };
  if (!storage) return fallback;
  const raw = storage.getItem(QUICK_CHECK_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<QuickCheckSession> | null;
    const draft = parsed?.draft;
    if (!draft || typeof draft !== "object") return fallback;
    const normalizedResult = normalizeResult(parsed?.result);
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
        createdAt: typeof draft.createdAt === "string" ? draft.createdAt : fallback.draft.createdAt,
        updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : fallback.draft.updatedAt,
      },
      result: normalizedResult,
      stagedUploads: normalizeStagedUploads(parsed?.stagedUploads),
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
  if (status === "supported") return "Continue to Review Workspace to preserve this check and expand the review.";
  if (status === "partial") return "Upload another evidence item or continue to Review Workspace to close the gap.";
  if (status === "missing-evidence") return "Upload stronger evidence, then run the check again.";
  return "Continue to Review Workspace to add reviewer context or attach stronger evidence.";
}

export function buildQuickCheckWorkspaceUrl(methodCode: string, version: string, ruleId: string): string {
  return `/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}?tab=verify&mode=list&rule=${encodeURIComponent(ruleId)}`;
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
    url: buildQuickCheckWorkspaceUrl(methodCode, version, ruleId),
  };
}

export function loadQuickCheckInventory(methodCode: string, version: string): EvidenceInventoryItem[] {
  if (!methodCode.trim() || !version.trim()) return [];
  return buildEvidenceInventory(loadPins(methodCode, version));
}
