import { buildRequirementCoverageRows, reconcileRequirement } from "@/app/m/_lib/requirementCoverage";
import { buildEvidenceInventory, coalesceEvidencePins, linkEvidencePinToRequirement, linkPddFragmentToRequirement, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { createVerifierRunBundle, createReviewerArtifactContext, persistVerifierRunBundle, readVerifierRunBundle } from "@/lib/verify/runState";
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidencePin } from "@/lib/proofMap/types";

export type QuickCheckDraftStatus = "draft" | "checked";

export type QuickCheckDraft = {
  id: string;
  methodologyId: string;
  methodologyVersion: string;
  requirementId: string;
  evidenceIds: string[];
  status: QuickCheckDraftStatus;
  resultId?: string;
  linkedRunId?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickCheckResultVerdict = "Supported" | "Partial" | "Needs review" | "Missing evidence";

export type QuickCheckResult = {
  id: string;
  requirementId: string;
  requirementLabel: string;
  verdict: QuickCheckResultVerdict;
  explanation: string;
  citations: string[];
  nextStepHint: string;
};

type QuickCheckSession = {
  draft: QuickCheckDraft;
  result: QuickCheckResult | null;
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

const QUICK_CHECK_STORAGE_KEY = "a6:chat:quick-check:v1";

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

export function createQuickCheckDraft(seed?: Partial<Pick<QuickCheckDraft, "methodologyId" | "methodologyVersion">>): QuickCheckDraft {
  const timestamp = nowIso();
  return {
    id: newId("quick-check"),
    methodologyId: seed?.methodologyId?.trim() ?? "",
    methodologyVersion: seed?.methodologyVersion?.trim() ?? "",
    requirementId: "",
    evidenceIds: [],
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateQuickCheckDraft(draft: QuickCheckDraft): string[] {
  const errors: string[] = [];
  if (!draft.methodologyId.trim() || !draft.methodologyVersion.trim()) {
    errors.push("Choose a methodology before running a quick check.");
  }
  if (!draft.requirementId.trim()) {
    errors.push("Choose a requirement before running a quick check.");
  }
  if (!draft.evidenceIds.length) {
    errors.push("Attach or select at least one evidence item before running a quick check.");
  }
  return errors;
}

export function loadQuickCheckSession(seed?: Partial<Pick<QuickCheckDraft, "methodologyId" | "methodologyVersion">>): QuickCheckSession {
  const storage = getStorage();
  const fallback = { draft: createQuickCheckDraft(seed), result: null };
  if (!storage) return fallback;
  const raw = storage.getItem(QUICK_CHECK_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<QuickCheckSession> | null;
    const draft = parsed?.draft;
    if (!draft || typeof draft !== "object") return fallback;
    return {
      draft: {
        id: typeof draft.id === "string" ? draft.id : fallback.draft.id,
        methodologyId: typeof draft.methodologyId === "string" ? draft.methodologyId : fallback.draft.methodologyId,
        methodologyVersion: typeof draft.methodologyVersion === "string" ? draft.methodologyVersion : fallback.draft.methodologyVersion,
        requirementId: typeof draft.requirementId === "string" ? draft.requirementId : "",
        evidenceIds: Array.isArray(draft.evidenceIds) ? draft.evidenceIds.map((item) => String(item)).filter(Boolean) : [],
        status: draft.status === "checked" ? "checked" : "draft",
        resultId: typeof draft.resultId === "string" ? draft.resultId : undefined,
        linkedRunId: typeof draft.linkedRunId === "string" ? draft.linkedRunId : undefined,
        createdAt: typeof draft.createdAt === "string" ? draft.createdAt : fallback.draft.createdAt,
        updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : fallback.draft.updatedAt,
      },
      result:
        parsed?.result && typeof parsed.result === "object"
          ? {
              id: typeof parsed.result.id === "string" ? parsed.result.id : newId("quick-result"),
              requirementId: typeof parsed.result.requirementId === "string" ? parsed.result.requirementId : "",
              requirementLabel: typeof parsed.result.requirementLabel === "string" ? parsed.result.requirementLabel : "",
              verdict:
                parsed.result.verdict === "Supported" ||
                parsed.result.verdict === "Partial" ||
                parsed.result.verdict === "Needs review" ||
                parsed.result.verdict === "Missing evidence"
                  ? parsed.result.verdict
                  : "Needs review",
              explanation: typeof parsed.result.explanation === "string" ? parsed.result.explanation : "",
              citations: Array.isArray(parsed.result.citations)
                ? parsed.result.citations.map((item) => String(item)).filter(Boolean)
                : [],
              nextStepHint: typeof parsed.result.nextStepHint === "string" ? parsed.result.nextStepHint : "",
            }
          : null,
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
  const linkedSelection = input.inventoryItems
    .filter((item) => input.draft.evidenceIds.includes(item.evidence_id))
    .map((item) => {
      if (item.kind === "pdd" && item.pdd_fragments?.length) {
        const fragment = item.pdd_fragments[0]!;
        return {
          ...item,
          link_state: "linked" as const,
          linked_requirement_ids: [input.draft.requirementId],
          pdd_fragment_links: [{ fragment_id: fragment.fragment_id, rule_id: input.draft.requirementId }],
        };
      }
      return {
        ...item,
        link_state: "linked" as const,
        linked_requirement_ids: [input.draft.requirementId],
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
    requirementId: input.draft.requirementId,
    requirementLabel: `${input.draft.requirementId} · ${input.rule.title}`,
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
  if (status === "partial") return "Add another evidence item or continue to Review Workspace to close the gap.";
  if (status === "missing-evidence") return "Attach stronger evidence, then run the check again.";
  return "Continue to Review Workspace to add reviewer context or attach stronger evidence.";
}

export function buildQuickCheckWorkspaceUrl(methodCode: string, version: string, ruleId: string): string {
  return `/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}?tab=verify&mode=list&rule=${encodeURIComponent(ruleId)}`;
}

export function ensureQuickCheckWorkspaceHandoff(draft: QuickCheckDraft): { draft: QuickCheckDraft; url: string } {
  const methodCode = draft.methodologyId.trim();
  const version = draft.methodologyVersion.trim();
  const ruleId = draft.requirementId.trim();
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
