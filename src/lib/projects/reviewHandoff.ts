import { getReview, getAllReviews, saveReview, type RuleReview as CanonicalRuleReview } from "@/lib/verify/reviewStore";
import {
  buildLinkedRulesKey,
  createReviewerArtifactContext,
  persistLinkedRuleIds,
  persistReviewerArtifactState,
  persistVerifierRunBundle,
  readLinkedRuleIdsFromStorage,
  readReviewerArtifactState,
  readRunHistory,
  readVerifierRunBundle,
  type ReviewerArtifactState,
  type VerifierRunBundle,
  type VerifyRunHistoryEntry,
} from "@/lib/verify/runState";
import {
  loadAoi,
  loadDraftAoi,
  loadEvidenceSnapshots,
  loadPins,
  loadVerificationRuns,
  saveAoi,
  saveDraftAoi,
  saveEvidenceSnapshots,
  savePins,
  saveVerificationRuns,
} from "@/lib/proofMap/storage";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { createProject, updateProject } from "@/lib/projects/storage";
import type { Project, RuleReview, RuleReviewStatus } from "@/lib/projects/types";
import { ensureReviewWorkspace } from "@/lib/reviewWorkspaces/storage";
import type { ReviewWorkspace } from "@/lib/reviewWorkspaces/types";

const PENDING_HANDOFF_KEY = "article6:pending-project-review-handoff";

type SourceScope = {
  methodCode: string;
  methodVersion: string;
  workspaceId?: string | null;
  projectId?: string | null;
};

export type PendingProjectReviewHandoff = {
  source: SourceScope;
  currentAoi: AOI | null;
  draftAoi: AOI | null;
  evidencePins: EvidencePin[];
  evidenceSnapshots: ProofEvidenceItem[];
  verificationRuns: VerificationRun[];
  verifierBundle: VerifierRunBundle;
  runHistory: VerifyRunHistoryEntry[];
  linkedRuleIds: string[];
  reviews: Record<string, CanonicalRuleReview>;
  reviewerArtifacts: ReviewerArtifactState[];
  stagedAt: string;
};

export function buildProjectReviewHref(input: {
  methodCode: string;
  methodVersion: string;
  projectId: string;
  workspaceId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("projectId", input.projectId);
  if (input.workspaceId?.trim()) params.set("workspaceId", input.workspaceId.trim());
  params.set("tab", "verify");
  return `/m/${encodeURIComponent(input.methodCode)}/v/${encodeURIComponent(input.methodVersion)}?${params.toString()}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage ?? null;
}

function toProjectStatus(status: CanonicalRuleReview["status"]): RuleReviewStatus {
  switch (status) {
    case "verified":
      return "verified";
    case "not_verified":
      return "gap";
    case "needs_followup":
      return "in-progress";
    case "pending":
    default:
      return "not-started";
  }
}

function deriveEvidenceIdsForRule(ruleId: string, evidencePins: EvidencePin[]): string[] {
  const linked = new Set<string>();
  for (const pin of evidencePins) {
    const hasDirectRule = pin.ruleId === ruleId;
    const hasCitedRule = (pin.cited_ids ?? []).includes(ruleId);
    const fragmentLinks = pin.pdd_fragment_links?.filter((link) => link.rule_id === ruleId) ?? [];
    if (!hasDirectRule && !hasCitedRule && fragmentLinks.length === 0) continue;
    linked.add(pin.id);
    for (const fragmentLink of fragmentLinks) linked.add(fragmentLink.fragment_id);
  }
  return Array.from(linked).sort((a, b) => a.localeCompare(b));
}

function buildInitialProjectReviews(input: {
  rules: Array<{ id: string; title: string; sectionId?: string }>;
  reviews: Record<string, CanonicalRuleReview>;
  evidencePins: EvidencePin[];
}): RuleReview[] {
  const latestByRule = new Map<string, CanonicalRuleReview>();
  for (const review of Object.values(input.reviews)) {
    const current = latestByRule.get(review.ruleId);
    if (!current || current.updatedAt.localeCompare(review.updatedAt) < 0) {
      latestByRule.set(review.ruleId, review);
    }
  }
  return input.rules.map((rule) => {
    const canonical = latestByRule.get(rule.id);
    if (!canonical) {
      return {
        ruleId: rule.id,
        ruleTitle: rule.title,
        sectionId: rule.sectionId ?? "",
        status: "not-started",
        evidenceIds: [],
      };
    }
    return {
      ruleId: rule.id,
      ruleTitle: rule.title,
      sectionId: rule.sectionId ?? "",
      status: toProjectStatus(canonical.status),
      outcome:
        canonical.status === "verified"
          ? "pass"
          : canonical.status === "not_verified"
            ? "fail"
            : canonical.status === "needs_followup"
              ? "partial"
              : undefined,
      note: canonical.rationale || canonical.reviewerOutcomeNote || undefined,
      evidenceIds: deriveEvidenceIdsForRule(rule.id, input.evidencePins),
      reviewedAt: canonical.reviewedAt,
    };
  });
}

function cloneVerifierBundle(bundle: VerifierRunBundle, workspaceId: string): VerifierRunBundle {
  return {
    ...bundle,
    reviewerContext: { ...bundle.reviewerContext, workspaceId },
    savedReviewerArtifactContext: bundle.savedReviewerArtifactContext
      ? { ...bundle.savedReviewerArtifactContext, workspaceId }
      : null,
  };
}

function persistRunHistory(methodCode: string, methodVersion: string, entries: VerifyRunHistoryEntry[], workspaceId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`verifyRunHistory:workspace:${workspaceId}`, JSON.stringify(entries));
}

function collectReviewerArtifacts(input: {
  source: SourceScope;
  verifierBundle: VerifierRunBundle;
  reviews: Record<string, CanonicalRuleReview>;
}): ReviewerArtifactState[] {
  const artifacts: ReviewerArtifactState[] = [];
  const bundleArtifact = readReviewerArtifactState(input.verifierBundle.reviewerContext);
  if (bundleArtifact) artifacts.push(bundleArtifact);
  for (const review of Object.values(input.reviews)) {
    const context = createReviewerArtifactContext({
      methodCode: input.source.methodCode,
      version: input.source.methodVersion,
      workspaceId: input.source.workspaceId,
      ruleId: review.ruleId,
      runId: review.runId ?? input.verifierBundle.runContext.runId,
    });
    const artifact = readReviewerArtifactState(context);
    if (artifact) artifacts.push(artifact);
  }
  return artifacts;
}

export function stagePendingProjectReviewHandoff(source: SourceScope): PendingProjectReviewHandoff | null {
  if (typeof window === "undefined") return null;
  const reviews =
    getAllReviews(source.methodCode, source.methodVersion, source.workspaceId, readVerifierRunBundle(source.methodCode, source.methodVersion, source.workspaceId).runContext.runId);
  const fallbackReviews = Object.keys(reviews).length
    ? reviews
    : getAllReviews(source.methodCode, source.methodVersion, source.workspaceId);
  const verifierBundle = readVerifierRunBundle(source.methodCode, source.methodVersion, source.workspaceId);
  const handoff: PendingProjectReviewHandoff = {
    source,
    currentAoi: loadAoi(source.methodCode, source.methodVersion, source.workspaceId),
    draftAoi: loadDraftAoi(source.methodCode, source.methodVersion, source.workspaceId),
    evidencePins: loadPins(source.methodCode, source.methodVersion, source.workspaceId),
    evidenceSnapshots: loadEvidenceSnapshots(source.methodCode, source.methodVersion, source.workspaceId),
    verificationRuns: loadVerificationRuns(source.methodCode, source.methodVersion, source.workspaceId),
    verifierBundle,
    runHistory: readRunHistory(source.methodCode, source.methodVersion, source.workspaceId),
    linkedRuleIds: readLinkedRuleIdsFromStorage(source.methodCode, source.methodVersion, source.workspaceId),
    reviews: fallbackReviews,
    reviewerArtifacts: collectReviewerArtifacts({ source, verifierBundle, reviews: fallbackReviews }),
    stagedAt: new Date().toISOString(),
  };
  getStorage()?.setItem(PENDING_HANDOFF_KEY, JSON.stringify(handoff));
  return handoff;
}

export function readPendingProjectReviewHandoff(): PendingProjectReviewHandoff | null {
  const raw = getStorage()?.getItem(PENDING_HANDOFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingProjectReviewHandoff;
  } catch {
    return null;
  }
}

export function clearPendingProjectReviewHandoff(): void {
  getStorage()?.removeItem(PENDING_HANDOFF_KEY);
}

export function importMethodologyReviewIntoProject(input: {
  handoff: PendingProjectReviewHandoff;
  projectFields: {
    name: string;
    projectCode?: string;
    countryLocation?: string;
    proponent?: string;
    methodology?: string;
    standard?: string;
    reportingPeriod?: string;
    aoiLabel?: string;
    description?: string;
    sourceDocumentType?: string;
    sourceDocumentVersion?: string;
    sourceDocumentDate?: string;
    methodCategory?: string;
    registry?: Project["registry"];
    createdFromDocumentDraft?: Project["createdFromDocumentDraft"];
  };
  rules: Array<{ id: string; title: string; sectionId?: string }>;
}): { project: Project; workspace: ReviewWorkspace; href: string } {
  const methodCode = input.handoff.source.methodCode;
  const methodVersion = input.handoff.source.methodVersion;
  const initialReviews = buildInitialProjectReviews({
    rules: input.rules,
    reviews: input.handoff.reviews,
    evidencePins: input.handoff.evidencePins,
  });

  const project = createProject({
    ...input.projectFields,
    reviewMode: "methodology-linked",
    methodCode,
    methodVersion,
    ruleIds: input.rules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      sectionId: rule.sectionId ?? "",
    })),
    initialReviews,
  });

  const workspace = ensureReviewWorkspace({
    projectId: project.id,
    projectName: project.name,
    projectCode: project.projectCode,
    methodCode,
    methodVersion,
    reportingPeriod: input.projectFields.reportingPeriod,
  });

  updateProject(project.id, {
    methodCode,
    methodVersion,
    reportingPeriod: workspace.reportingPeriod ?? input.projectFields.reportingPeriod,
    lastWorkspaceId: workspace.id,
  });

  saveAoi(methodCode, methodVersion, input.handoff.currentAoi, workspace.id);
  saveDraftAoi(methodCode, methodVersion, input.handoff.draftAoi, workspace.id);
  savePins(methodCode, methodVersion, input.handoff.evidencePins, workspace.id);
  saveEvidenceSnapshots(methodCode, methodVersion, input.handoff.evidenceSnapshots, workspace.id);
  saveVerificationRuns(methodCode, methodVersion, input.handoff.verificationRuns, workspace.id);
  persistLinkedRuleIds(buildLinkedRulesKey(methodCode, methodVersion, workspace.id), input.handoff.linkedRuleIds);
  persistVerifierRunBundle(methodCode, methodVersion, cloneVerifierBundle(input.handoff.verifierBundle, workspace.id), workspace.id);
  persistRunHistory(methodCode, methodVersion, input.handoff.runHistory, workspace.id);

  for (const review of Object.values(input.handoff.reviews)) {
    saveReview({ ...review, workspaceId: workspace.id });
  }
  for (const artifact of input.handoff.reviewerArtifacts) {
    persistReviewerArtifactState({
      ...artifact,
      context: { ...artifact.context, workspaceId: workspace.id },
    });
  }

  clearPendingProjectReviewHandoff();

  return {
    project: updateProject(project.id, { lastWorkspaceId: workspace.id }) ?? project,
    workspace,
    href: buildProjectReviewHref({
      methodCode,
      methodVersion,
      projectId: project.id,
      workspaceId: workspace.id,
    }),
  };
}

export function getImportedReviewForRule(input: {
  handoff: PendingProjectReviewHandoff;
  ruleId: string;
}): CanonicalRuleReview | null {
  const currentRunId = input.handoff.verifierBundle.runContext.runId;
  return (
    getReview(
      input.ruleId,
      input.handoff.source.methodCode,
      input.handoff.source.methodVersion,
      input.handoff.source.workspaceId,
      currentRunId,
    ) ??
    Object.values(input.handoff.reviews).find((review) => review.ruleId === input.ruleId) ??
    null
  );
}
