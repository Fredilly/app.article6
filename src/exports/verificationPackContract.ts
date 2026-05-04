import { canonicalStringify } from "../integrity/artifacts";
import type { EvidenceSnapshot } from "../lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "../lib/proofMap/types";
import type { TraceIndex, TraceSectionLink } from "../lib/trace/traceIndex";
import type { RuleReview } from "../lib/verify/reviewStore";
import { normalizeMethodCode, normalizeVersion, type VerifierRunBundle } from "../lib/verify/runState";

type ContractRule = {
  id: string;
  text: string;
};

type ProjectJson = {
  kind: "article6.verification_project";
  version: 1;
  generated_at: string;
  method: {
    code: string;
    version: string;
    rule_count: number;
    section_count: number;
  };
  pack_profile: {
    name: "demo_verification_contract" | "method_review_export" | "finalized_review_export";
    human_label: string;
    disclaimer: string;
    not_a_formal_opinion: true;
  };
  project_context: {
    project_id: string;
    export_id: string;
    display_name: string;
    reporting_period: string;
    location: string;
    description: string;
    placeholder: boolean;
    placeholder_reason: string;
  };
  reviewer_assignment: {
    display_name: string;
    role: string;
    organization: string;
    placeholder: boolean;
    placeholder_reason: string;
  };
};

type EvidenceManifestEntry = {
  evidence_ref: string;
  label: string;
  rule_ids: string[];
  status: "not_provided" | "provided";
  status_basis: "demo_placeholder" | "current_method_review" | "finalized_project_review";
  source_kind: "project_evidence_slot" | "project_evidence_ref";
  included_in_pack: boolean;
  file_path: null;
  sha256: null;
  requested_for: string;
  placeholder: boolean;
  placeholder_reason: string;
  fragment_id?: string;
  source_pin_id?: string;
  evidence_title?: string;
  evidence_type?: string;
};

type EvidenceManifest = {
  kind: "article6.evidence_manifest";
  version: 1;
  generated_at: string;
  method: {
    code: string;
    version: string;
  };
  summary: {
    total_refs: number;
    provided_refs: number;
    placeholder_refs: number;
  };
  placeholder_policy: {
    all_entries_marked_placeholder: boolean;
    reason: string;
  };
  evidence: EvidenceManifestEntry[];
};

type RequirementReviewEntry = {
  rule_id: string;
  status:
    | "awaiting_project_evidence"
    | "finalized"
    | "finalized_review_data_missing"
    | "not_reviewed"
    | "reviewed_verified"
    | "reviewed_not_verified"
    | "reviewed_needs_followup";
  status_basis: "demo_placeholder" | "current_method_review" | "finalized_project_review";
  rationale: string;
  linked_evidence_refs: string[];
  requested_evidence_refs: string[];
  reviewer: {
    display_name: string;
    role: string;
    placeholder: boolean;
    placeholder_reason: string;
  };
  timestamps: {
    record_created_at: string;
    last_updated_at: string;
    reviewed_at: string | null;
  };
  methodology_trace: {
    section_ids: string[];
  };
  reconciliation?: {
    status: string | null;
    reason: string | null;
  };
  reviewer_artifact?: {
    run_id: string | null;
    finalized_state: string | null;
    finalized_at: string | null;
    minutes_present: boolean;
    outcome_note: string | null;
  };
  stac_support_facts?: {
    lookup_status: string;
    available_unlinked_ids: string[];
    linked_facts: Array<{
      id: string;
      datetime: string | null;
      collection: string | null;
      source_catalog_ref: string | null;
      source_provider: string | null;
      linked_at: string | null;
      aoi_relation_summary: string | null;
      asset_href: string | null;
      link_href: string | null;
      source_pin_ids: string[];
      linked_rule_ids: string[];
    }>;
    stale_facts?: Array<{
      id: string;
      datetime: string | null;
      collection: string | null;
      source_catalog_ref: string | null;
      source_provider: string | null;
      linked_at: string | null;
      aoi_relation_summary: string | null;
      asset_href: string | null;
      link_href: string | null;
      source_pin_ids: string[];
      linked_rule_ids: string[];
    }>;
  };
};

type RequirementReview = {
  kind: "article6.requirement_review";
  version: 1;
  generated_at: string;
  method: {
    code: string;
    version: string;
  };
  summary: {
    total_rules: number;
    placeholder_rule_reviews: number;
    linked_evidence_refs: number;
  };
  placeholder_policy: {
    all_rule_reviews_marked_placeholder: boolean;
    reason: string;
  };
  rules: RequirementReviewEntry[];
};

type TrailEntry = {
  ts: string;
  actor: "system";
  action:
    | "trail.init"
    | "verification_contract.project_seeded"
    | "verification_contract.evidence_manifest_seeded"
    | "verification_contract.requirement_review_seeded"
    | "verification_contract.trace_updated"
    | "verification_contract.report_derived";
  meta: Record<string, unknown>;
};

type VerificationPackContract = {
  project: ProjectJson;
  evidenceManifest: EvidenceManifest;
  requirementReview: RequirementReview;
  trace: TraceIndex & {
    verification_contract: {
      mode:
        | "demo_placeholder_review_contract"
        | "current_method_review_contract"
        | "finalized_project_review_contract";
      project_path: "project.json";
      evidence_manifest_path: "evidence-manifest.json";
      requirement_review_path: "requirement-review.json";
      trail_path: "trail.jsonl";
      report_path: "VERIFICATION_REPORT.html";
      placeholder: boolean;
      placeholder_reason: string;
    };
    rule_to_review: Record<
      string,
      {
        requirement_review_path: "requirement-review.json";
        rule_id: string;
        status: RequirementReviewEntry["status"];
        status_basis: string;
        linked_evidence_refs: string[];
        requested_evidence_refs: string[];
        placeholder: boolean;
      }
    >;
  };
  trailEntries: TrailEntry[];
  reportHtml: string;
};

const PLACEHOLDER_REASON =
  "Real project-specific evidence, reviewer assignment, and verification outcomes are not available in this methodology-only demo contract.";

const FINALIZED_REVIEW_REASON =
  "This audit pack was generated from a finalized local review artifact supplied by the export caller.";

const CURRENT_METHOD_REVIEW_REASON =
  "This audit pack was generated from current local Method Review state supplied by the browser export flow.";

export type FinalizedAuditPackReviewInput = {
  artifact?: EvidenceSnapshot | null;
  evidencePins?: EvidencePin[] | null;
};

export type CurrentMethodReviewExportInput = {
  latestReviewAt?: string | null;
  reviews?: RuleReview[] | null;
  verifierBundle?: Partial<VerifierRunBundle> | null;
  evidencePins?: EvidencePin[] | null;
};

function extractRules(rulesJson: unknown): ContractRule[] {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === "object" && Array.isArray((rulesJson as { rules?: unknown[] }).rules)
      ? ((rulesJson as { rules: unknown[] }).rules ?? [])
      : [];

  return items
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const id =
        typeof record.id === "string" ? record.id.trim()
        : typeof record.rule_id === "string" ? record.rule_id.trim()
        : typeof record.ruleId === "string" ? record.ruleId.trim()
        : typeof record.key === "string" ? record.key.trim()
        : "";
      if (!id) return [];
      const text = typeof record.text === "string" ? record.text.trim() : "";
      return [{ id, text }];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function extractSectionCount(sectionsJson: unknown): number {
  const items = Array.isArray(sectionsJson)
    ? sectionsJson
    : sectionsJson && typeof sectionsJson === "object" && Array.isArray((sectionsJson as { sections?: unknown[] }).sections)
      ? ((sectionsJson as { sections: unknown[] }).sections ?? [])
      : [];
  return items.length;
}

function evidenceRefForRule(ruleId: string): string {
  return `placeholder-evidence:${ruleId}`;
}

function isPackagedEvidenceEntry(entry: Pick<EvidenceManifestEntry, "included_in_pack" | "sha256" | "file_path">): boolean {
  return Boolean(entry.included_in_pack || entry.sha256 || entry.file_path);
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function canonicalRuleKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(R-\d+(?:-\d+)*)$/i);
  return match ? match[1] : trimmed;
}

function ruleIdsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftTrimmed = left?.trim() ?? "";
  const rightTrimmed = right?.trim() ?? "";
  if (!leftTrimmed || !rightTrimmed) return false;
  if (leftTrimmed === rightTrimmed) return true;
  return canonicalRuleKey(leftTrimmed) === canonicalRuleKey(rightTrimmed);
}

function asValidIsoOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return Number.isFinite(new Date(trimmed).getTime()) ? trimmed : null;
}

function pickLatestTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const iso = asValidIsoOrNull(value);
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (ms > latestMs) {
      latest = iso;
      latestMs = ms;
    }
  }
  return latest;
}

function hasCurrentMethodReviewInput(input: CurrentMethodReviewExportInput | null | undefined): boolean {
  return Boolean(input);
}

function evidenceRefsFromPinsForRule(
  ruleId: string | null,
  evidencePins: EvidencePin[],
  statusBasis: EvidenceManifestEntry["status_basis"],
  requestedForPrefix: string,
): EvidenceManifestEntry[] {
  const entries: EvidenceManifestEntry[] = [];
  for (const pin of evidencePins) {
    const linkedRuleIds = uniqueSorted([
      pin.ruleId,
      ...(pin.cited_ids ?? []),
      ...(pin.pdd_fragment_links ?? []).map((link) => link.rule_id),
    ]);
    const matchingLinkedRuleIds = ruleId
      ? linkedRuleIds.filter((linkedRuleId) => ruleIdsMatch(linkedRuleId, ruleId))
      : linkedRuleIds;
    const matchingFragmentLinks = (pin.pdd_fragment_links ?? []).filter((link) =>
      ruleId ? ruleIdsMatch(link.rule_id, ruleId) : Boolean(link.rule_id?.trim()),
    );
    if (ruleId && matchingLinkedRuleIds.length === 0 && matchingFragmentLinks.length === 0) continue;

    const baseRuleIds = ruleId
      ? [ruleId]
      : linkedRuleIds.length
        ? linkedRuleIds
        : [];
    const pinRefs = uniqueSorted([pin.itemId, ...(pin.stac_item_ids ?? []), pin.pdd_document?.evidence_id, pin.id]);
    for (const ref of pinRefs) {
      entries.push({
        evidence_ref: ref,
        label: pin.title || ref,
        rule_ids: [...baseRuleIds],
        status: "not_provided",
        status_basis: statusBasis,
        source_kind: "project_evidence_ref",
        included_in_pack: false,
        file_path: null,
        sha256: null,
        requested_for: ruleId ? `${requestedForPrefix} linked to ${ruleId}` : requestedForPrefix,
        placeholder: false,
        placeholder_reason: "",
        source_pin_id: pin.id,
        evidence_title: pin.title,
        evidence_type: pin.kind,
      });
    }

    for (const link of matchingFragmentLinks) {
      const fragment = pin.pdd_fragments?.find((candidate) => candidate.fragment_id === link.fragment_id);
      entries.push({
        evidence_ref: link.fragment_id,
        label: fragment?.label?.trim() || fragment?.section_heading?.trim() || link.fragment_id,
        rule_ids: ruleId ? [ruleId] : [link.rule_id],
        status: "not_provided",
        status_basis: statusBasis,
        source_kind: "project_evidence_ref",
        included_in_pack: false,
        file_path: null,
        sha256: null,
        requested_for: `${requestedForPrefix} fragment linked to ${link.rule_id}`,
        placeholder: false,
        placeholder_reason: "",
        fragment_id: link.fragment_id,
        source_pin_id: pin.id,
        evidence_title: pin.title,
        evidence_type: pin.kind,
      });
    }
  }

  const byRef = new Map<string, EvidenceManifestEntry>();
  for (const entry of entries) {
    const current = byRef.get(entry.evidence_ref);
    if (!current) {
      byRef.set(entry.evidence_ref, entry);
      continue;
    }
    byRef.set(entry.evidence_ref, {
      ...current,
      rule_ids: uniqueSorted([...current.rule_ids, ...entry.rule_ids]),
    });
  }
  return Array.from(byRef.values()).sort((a, b) => a.evidence_ref.localeCompare(b.evidence_ref));
}

function reviewerArtifactForCurrentRule(
  ruleId: string,
  methodCode: string,
  version: string,
  bundle: Partial<VerifierRunBundle> | null | undefined,
): RequirementReviewEntry["reviewer_artifact"] | undefined {
  if (!bundle) return undefined;
  const contextMethodCode = bundle.savedReviewerArtifactContext?.methodCode?.trim() ?? null;
  const contextVersion = bundle.savedReviewerArtifactContext?.version?.trim() ?? null;
  const contextRuleId = bundle.savedReviewerArtifactContext?.ruleId?.trim() ?? null;
  const canonicalContextRuleId = canonicalRuleKey(contextRuleId);
  const canonicalCurrentRuleId = canonicalRuleKey(ruleId);
  const savedReviewerArtifactAt = bundle.savedReviewerArtifactAt?.trim() || null;
  const finalizedAt = bundle.finalizedAt?.trim() || null;
  if (normalizeMethodCode(contextMethodCode ?? "") !== normalizeMethodCode(methodCode)) return undefined;
  if (normalizeVersion(contextVersion ?? "") !== normalizeVersion(version)) return undefined;
  if (contextRuleId !== ruleId && canonicalContextRuleId !== canonicalCurrentRuleId) return undefined;
  if (!savedReviewerArtifactAt && !finalizedAt) return undefined;
  return {
    run_id:
      bundle.savedReviewerArtifactContext?.runId?.trim() ||
      bundle.runContext?.runId?.trim() ||
      bundle.reviewerContext?.runId?.trim() ||
      null,
    finalized_state: finalizedAt ? "finalized" : "draft",
    finalized_at: finalizedAt,
    minutes_present: Boolean(bundle.minutes?.trim()),
    outcome_note: bundle.outcomeNote?.trim() || null,
  };
}

function requestedEvidenceRefsForCurrentReview(review: RuleReview | null): string[] {
  if (!review) return [];
  return uniqueSorted([
    review.supportReference,
    review.evidenceLink,
    ...review.evidenceAttachments.map((attachment) => attachment.label || attachment.id),
  ]);
}

function evidenceRefsFromCurrentReviewRecord(
  ruleId: string,
  review: RuleReview | null,
): EvidenceManifestEntry[] {
  if (!review) return [];
  const referencedEvidence = uniqueSorted([
    review.supportReference,
    review.evidenceLink,
    ...review.evidenceAttachments.map((attachment) => attachment.label || attachment.id),
  ]);

  return referencedEvidence.map((ref) => ({
    evidence_ref: ref,
    label: ref,
    rule_ids: [ruleId],
    status: "not_provided" as const,
    status_basis: "current_method_review" as const,
    source_kind: "project_evidence_ref" as const,
    included_in_pack: false,
    file_path: null,
    sha256: null,
    requested_for: review.rationale?.trim() || `Referenced in current Method Review for ${ruleId}`,
    placeholder: false,
    placeholder_reason: "",
    evidence_title: ref,
    evidence_type: "reference",
  }));
}

function mergeEvidenceManifestEntries(entries: EvidenceManifestEntry[]): EvidenceManifestEntry[] {
  const byRef = new Map<string, EvidenceManifestEntry>();
  for (const entry of entries) {
    const current = byRef.get(entry.evidence_ref);
    if (!current) {
      byRef.set(entry.evidence_ref, entry);
      continue;
    }
    byRef.set(entry.evidence_ref, {
      ...current,
      label: current.label || entry.label,
      rule_ids: uniqueSorted([...current.rule_ids, ...entry.rule_ids]),
      status:
        isPackagedEvidenceEntry(current) || isPackagedEvidenceEntry(entry)
          ? "provided"
          : "not_provided",
      included_in_pack: current.included_in_pack || entry.included_in_pack,
      requested_for: current.requested_for || entry.requested_for,
      placeholder: current.placeholder && entry.placeholder,
      placeholder_reason: current.placeholder_reason || entry.placeholder_reason,
      fragment_id: current.fragment_id ?? entry.fragment_id,
      source_pin_id: current.source_pin_id ?? entry.source_pin_id,
      evidence_title: current.evidence_title ?? entry.evidence_title,
      evidence_type: current.evidence_type ?? entry.evidence_type,
    });
  }
  return Array.from(byRef.values()).sort((a, b) => a.evidence_ref.localeCompare(b.evidence_ref));
}

function selectedRuleFromArtifact(artifact: EvidenceSnapshot | null | undefined): string | null {
  return (
    artifact?.summary?.ruleId?.trim() ||
    artifact?.outcome?.linkage.selectedRuleId?.trim() ||
    artifact?.outcome?.linkage.linkedRuleIds[0]?.trim() ||
    null
  );
}

function stacSupportFactsForArtifact(artifact: EvidenceSnapshot | null | undefined): RequirementReviewEntry["stac_support_facts"] | undefined {
  if (!artifact?.support_facts) return undefined;
  return {
    lookup_status: artifact.support_facts.lookup_status,
    available_unlinked_ids: [...artifact.support_facts.available_unlinked_ids],
    linked_facts: artifact.support_facts.linked_facts.map((fact) => ({
      id: fact.id,
      datetime: fact.datetime ?? null,
      collection: fact.collection ?? null,
      source_catalog_ref: fact.source_catalog_ref ?? null,
      source_provider: fact.source_provider ?? null,
      linked_at: fact.linked_at ?? null,
      aoi_relation_summary: fact.aoi_relation_summary ?? null,
      asset_href: fact.asset_href ?? null,
      link_href: fact.link_href ?? null,
      source_pin_ids: [...fact.source_pin_ids],
      linked_rule_ids: [...fact.linked_rule_ids],
    })),
    stale_facts: (artifact.support_facts.stale_facts ?? []).map((fact) => ({
      id: fact.id,
      datetime: fact.datetime ?? null,
      collection: fact.collection ?? null,
      source_catalog_ref: fact.source_catalog_ref ?? null,
      source_provider: fact.source_provider ?? null,
      linked_at: fact.linked_at ?? null,
      aoi_relation_summary: fact.aoi_relation_summary ?? null,
      asset_href: fact.asset_href ?? null,
      link_href: fact.link_href ?? null,
      source_pin_ids: [...fact.source_pin_ids],
      linked_rule_ids: [...fact.linked_rule_ids],
    })),
  };
}

function evidenceRefsForRule(input: {
  ruleId: string | null;
  artifact: EvidenceSnapshot | null | undefined;
  evidencePins: EvidencePin[];
}): EvidenceManifestEntry[] {
  const entries: EvidenceManifestEntry[] = evidenceRefsFromPinsForRule(
    input.ruleId,
    input.evidencePins,
    "finalized_project_review",
    "Finalized review evidence",
  );
  const ruleId = input.ruleId;
  const selectedEvidenceId =
    input.artifact?.summary?.selectedEvidenceId?.trim() ||
    input.artifact?.selected?.id?.trim() ||
    input.artifact?.selected?.item?.id?.trim() ||
    null;

  if (selectedEvidenceId && !entries.some((entry) => entry.evidence_ref === selectedEvidenceId)) {
    entries.push({
      evidence_ref: selectedEvidenceId,
      label: selectedEvidenceId,
      rule_ids: ruleId ? [ruleId] : [],
      status: "not_provided",
      status_basis: "finalized_project_review",
      source_kind: "project_evidence_ref",
      included_in_pack: false,
      file_path: null,
      sha256: null,
      requested_for: ruleId ? `Finalized selected evidence for ${ruleId}` : "Finalized selected evidence",
      placeholder: false,
      placeholder_reason: "",
      evidence_title: selectedEvidenceId,
      evidence_type: "selected",
    });
  }
  return entries.sort((a, b) => a.evidence_ref.localeCompare(b.evidence_ref));
}

function summarizeRuleText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Method requirement text is present in the methodology files.";
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function humanizeRuleStatus(status: RequirementReviewEntry["status"]): string {
  switch (status) {
    case "awaiting_project_evidence":
      return "Awaiting project evidence";
    case "finalized":
      return "Finalized";
    case "finalized_review_data_missing":
      return "Finalized review data missing";
    case "not_reviewed":
      return "Not reviewed";
    case "reviewed_verified":
      return "Verified";
    case "reviewed_not_verified":
      return "Not verified";
    case "reviewed_needs_followup":
      return "Needs Follow-up";
  }
}

function humanizeStatusBasis(statusBasis: RequirementReviewEntry["status_basis"]): string {
  switch (statusBasis) {
    case "demo_placeholder":
      return "Demo placeholder";
    case "current_method_review":
      return "Current Method Review";
    case "finalized_project_review":
      return "Finalized local review";
  }
}

function renderFieldValue(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : escapeHtml(fallback);
}

function isUnavailableToken(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return true;
  return [
    "placeholder-not-provided",
    "not-supplied-in-method-review",
    "unavailable in local method review export",
    "demo placeholder project context",
    "current method review workspace",
    "local-method-review",
  ].includes(normalized);
}

function projectIdForDisplay(project: ProjectJson): string | null {
  const projectId = project.project_context.project_id?.trim() ?? "";
  if (
    !projectId ||
    isUnavailableToken(projectId) ||
    projectId === "local-method-review" ||
    projectId.startsWith("run-") ||
    /^[A-Z0-9-]+-v\d+(?:-\d+)*-\d{8,}$/i.test(projectId)
  ) {
    return null;
  }
  return projectId;
}

function exportIdForDisplay(project: ProjectJson): string | null {
  const exportId = project.project_context.export_id?.trim() ?? "";
  if (!exportId || isUnavailableToken(exportId)) return null;
  return exportId;
}

function projectLocationForDisplay(project: ProjectJson): string | null {
  const location = project.project_context.location?.trim() ?? "";
  if (!location || isUnavailableToken(location)) return null;
  return location;
}

function workspaceLabelForDisplay(project: ProjectJson): string | null {
  const label = project.project_context.display_name?.trim() ?? "";
  if (!label || isUnavailableToken(label) || label === "Demo placeholder project context") return null;
  return label;
}

function reportingPeriodForDisplay(project: ProjectJson): string | null {
  const period = project.project_context.reporting_period?.trim() ?? "";
  if (!period || isUnavailableToken(period)) return null;
  return period;
}

function renderVerificationReportHtml(input: {
  mode: VerificationPackContract["trace"]["verification_contract"]["mode"];
  project: ProjectJson;
  evidenceManifest: EvidenceManifest;
  requirementReview: RequirementReview;
  trace: VerificationPackContract["trace"];
}): string {
  const reviewedRules = input.requirementReview.rules.filter((rule) => rule.status !== "not_reviewed" && rule.status !== "awaiting_project_evidence");
  const unreviewedRules = input.requirementReview.rules.filter((rule) => rule.status === "not_reviewed" || rule.status === "awaiting_project_evidence");
  const followUpRules = input.requirementReview.rules.filter(
    (rule) => rule.status === "reviewed_needs_followup" || rule.status === "reviewed_not_verified" || rule.status === "finalized_review_data_missing",
  );
  const exportStatus =
    input.mode === "finalized_project_review_contract"
      ? "Finalized local review export"
      : input.mode === "current_method_review_contract"
        ? "Draft / incomplete local method review export"
        : "Demo placeholder review export";
  const reportTitle =
    input.mode === "finalized_project_review_contract"
      ? "Verification Readiness Review"
      : input.mode === "current_method_review_contract"
        ? "Verification Readiness Review"
        : "Verification Readiness Review Demo Skeleton";
  const reviewScope =
    input.mode === "finalized_project_review_contract"
      ? `Local finalized review artifact covering ${input.requirementReview.summary.total_rules} rule${input.requirementReview.summary.total_rules === 1 ? "" : "s"}.`
      : input.mode === "current_method_review_contract"
        ? `Current browser Method Review state across ${input.requirementReview.summary.total_rules} rule${input.requirementReview.summary.total_rules === 1 ? "" : "s"}.`
        : `Methodology-only placeholder scaffold across ${input.requirementReview.summary.total_rules} rule${input.requirementReview.summary.total_rules === 1 ? "" : "s"}.`;
  const bannerBody =
    input.mode === "finalized_project_review_contract"
      ? "This report skeleton is derived from methodology files plus an explicitly finalized local review artifact. It remains a readiness-oriented record, not a formal verifier opinion."
      : input.mode === "current_method_review_contract"
        ? "This report skeleton is derived from current browser Method Review state. It remains draft/incomplete unless the supplied review state is explicitly finalized."
        : "This report skeleton is derived from project.json, evidence-manifest.json, and requirement-review.json as a truthful placeholder, not a formal verifier opinion.";

  const reviewedRows = reviewedRules
    .map((rule) => {
      const requested = rule.requested_evidence_refs.length ? rule.requested_evidence_refs.join(", ") : "None";
      const linked = rule.linked_evidence_refs.length ? rule.linked_evidence_refs.join(", ") : "None";
      const basis = rule.reconciliation?.reason?.trim() || humanizeStatusBasis(rule.status_basis);
      return `<tr>
  <td><strong>${escapeHtml(rule.rule_id)}</strong><div class="muted">${escapeHtml(summarizeRuleText(rule.rationale))}</div></td>
  <td>${escapeHtml(humanizeRuleStatus(rule.status))}</td>
  <td>${escapeHtml(basis)}</td>
  <td><div><strong>Requested:</strong> ${escapeHtml(requested)}</div><div><strong>Linked:</strong> ${escapeHtml(linked)}</div></td>
  <td>${escapeHtml(rule.rationale)}</td>
</tr>`;
    })
    .join("\n");
  const unreviewedRows = unreviewedRules
    .map((rule) => `<tr>
  <td><strong>${escapeHtml(rule.rule_id)}</strong></td>
  <td>${escapeHtml(humanizeRuleStatus(rule.status))}</td>
  <td>${escapeHtml(summarizeRuleText(rule.rationale))}</td>
</tr>`)
    .join("\n");
  const evidenceRows = input.evidenceManifest.evidence
    .map((entry) => {
      const includedState = isPackagedEvidenceEntry(entry) ? "Included in pack" : "Referenced only — file not included";
      const sourceName = entry.evidence_title?.trim() || entry.label;
      return `<tr>
  <td>${escapeHtml(entry.evidence_ref)}</td>
  <td>${escapeHtml(sourceName)}</td>
  <td>${escapeHtml(entry.evidence_type || entry.source_kind)}</td>
  <td>${escapeHtml(entry.rule_ids.join(", ") || "None")}</td>
  <td>${escapeHtml(includedState)}</td>
  <td>${escapeHtml(entry.sha256 ?? "Unavailable")}</td>
</tr>`;
    })
    .join("\n");
  const findingsRows = followUpRules.length
    ? followUpRules
        .map((rule, index) => {
          const findingType =
            rule.status === "reviewed_needs_followup"
              ? "Needs Follow-up"
              : rule.status === "reviewed_not_verified"
                ? "Negative judgment"
                : "Incomplete finalized review data";
          const evidenceBasis = uniqueSorted([...rule.linked_evidence_refs, ...rule.requested_evidence_refs]).join(", ") || "No evidence refs recorded.";
          return `<tr>
  <td>F-${String(index + 1).padStart(3, "0")}</td>
  <td>${escapeHtml(rule.rule_id)}</td>
  <td>${escapeHtml(findingType)}</td>
  <td>${escapeHtml(rule.rationale)}</td>
  <td>${escapeHtml(evidenceBasis)}</td>
  <td>${escapeHtml(rule.status === "reviewed_needs_followup" ? rule.rationale : rule.requested_evidence_refs.join(", ") || "Record the missing reconciliation step.")}</td>
</tr>`;
        })
        .join("\n")
    : `<tr><td colspan="6">No follow-up or negative findings are recorded in this export.</td></tr>`;
  const followUpActions = followUpRules.length
    ? followUpRules
        .map((rule) => {
          const requested = rule.requested_evidence_refs.join(", ");
          const linked = rule.linked_evidence_refs.join(", ");
          const actionDetail =
            requested || linked
              ? `Reconcile referenced evidence (${requested || "none requested"}; linked ${linked || "none"}).`
              : "Record the missing evidence or reconciliation task for this rule.";
          return `<li><strong>${escapeHtml(rule.rule_id)}</strong>: ${escapeHtml(rule.rationale)} ${escapeHtml(actionDetail)}</li>`;
        })
        .join("\n")
    : `<li>No follow-up actions are recorded in this export.</li>`;
  const integrityRows = input.evidenceManifest.evidence
    .map((entry) => `<tr>
  <td>${escapeHtml(entry.evidence_ref)}</td>
  <td>${escapeHtml(isPackagedEvidenceEntry(entry) ? entry.file_path ?? "Included file path unavailable" : "Referenced only — file not included")}</td>
  <td>${escapeHtml(entry.sha256 ?? "Unavailable")}</td>
</tr>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportTitle)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; color: #0f172a; line-height: 1.5; }
      .banner { border: 1px solid #f59e0b; background: #fffbeb; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
      .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; background: #ffffff; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .muted { color: #64748b; font-size: 12px; margin-top: 4px; }
      .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; }
      h1, h2, h3 { margin-bottom: 8px; }
      p, li { color: #334155; }
      code { background: #f8fafc; padding: 2px 6px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
      dl { margin: 0; display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; }
      dt { font-weight: 600; color: #0f172a; }
      dd { margin: 0; color: #334155; }
    </style>
  </head>
  <body>
    <div class="banner">
      <strong>${escapeHtml(exportStatus)}.</strong>
      <div>${escapeHtml(bannerBody)}</div>
    </div>
    <section class="panel">
      <h1>${escapeHtml(reportTitle)}</h1>
      <div class="grid">
        <div>
          <dl>
            <dt>Methodology</dt><dd>${escapeHtml(input.project.method.code)}</dd>
            <dt>Version</dt><dd>${escapeHtml(input.project.method.version)}</dd>
            <dt>Export status</dt><dd>${escapeHtml(exportStatus)}</dd>
            <dt>Generated</dt><dd>${renderFieldValue(input.project.generated_at, "Unavailable")}</dd>
            <dt>Review scope</dt><dd>${escapeHtml(reviewScope)}</dd>
          </dl>
        </div>
        <div>
          <p>${escapeHtml(input.project.pack_profile.disclaimer)}</p>
          <p>This report is a structured Verification Readiness Review skeleton. It is not a formal validation opinion, formal verification opinion, certification decision, or VVB approval.</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Executive Summary</h2>
      <p><strong>Overall status:</strong> ${escapeHtml(exportStatus)}</p>
      <p>This export preserves local review state and methodology traceability, but it is not a formal verifier opinion.</p>
      <div class="stats">
        <div class="stat"><strong>Total rules</strong><div>${input.requirementReview.summary.total_rules}</div></div>
        <div class="stat"><strong>Reviewed</strong><div>${reviewedRules.length}</div></div>
        <div class="stat"><strong>Unreviewed</strong><div>${unreviewedRules.length}</div></div>
        <div class="stat"><strong>Needs follow-up</strong><div>${followUpRules.length}</div></div>
        <div class="stat"><strong>Evidence refs</strong><div>${input.evidenceManifest.summary.total_refs}</div></div>
      </div>
    </section>

    <section class="panel">
      <h2>Project Context</h2>
      <dl>
        <dt>Project name</dt><dd>Not provided</dd>
        <dt>Project ID</dt><dd>${renderFieldValue(projectIdForDisplay(input.project), "Not provided")}</dd>
        <dt>Country / location</dt><dd>${renderFieldValue(projectLocationForDisplay(input.project), "Not provided")}</dd>
        <dt>Proponent</dt><dd>Not provided</dd>
        <dt>Methodology / version</dt><dd>${escapeHtml(input.project.method.code)} @ ${escapeHtml(input.project.method.version)}</dd>
        <dt>Reporting period</dt><dd>${renderFieldValue(reportingPeriodForDisplay(input.project), "Not provided")}</dd>
        <dt>Review workspace</dt><dd>${renderFieldValue(workspaceLabelForDisplay(input.project), "Unavailable")}</dd>
      </dl>
    </section>

    <section class="panel">
      <h2>Evidence Register</h2>
      <p>Referenced evidence is listed separately from included files. Evidence is only treated as included when the pack actually contains the file.</p>
      <table>
        <thead>
          <tr>
            <th>Evidence ref</th>
            <th>File / source name</th>
            <th>Evidence type</th>
            <th>Linked rule(s)</th>
            <th>Included in pack</th>
            <th>SHA-256</th>
          </tr>
        </thead>
        <tbody>
${evidenceRows}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Requirement Review</h2>
      <h3>Reviewed rules</h3>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Status</th>
            <th>Basis</th>
            <th>Requested / linked evidence refs</th>
            <th>Reviewer rationale</th>
          </tr>
        </thead>
        <tbody>
${reviewedRows || '<tr><td colspan="5">No reviewed rules are recorded in this export.</td></tr>'}
        </tbody>
      </table>
      <h3>Unreviewed rules</h3>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Status</th>
            <th>Current basis</th>
          </tr>
        </thead>
        <tbody>
${unreviewedRows || '<tr><td colspan="3">No unreviewed rules remain.</td></tr>'}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Findings</h2>
      <table>
        <thead>
          <tr>
            <th>Finding ID</th>
            <th>Linked rule</th>
            <th>Finding type</th>
            <th>Issue summary</th>
            <th>Evidence basis</th>
            <th>Required follow-up</th>
          </tr>
        </thead>
        <tbody>
${findingsRows}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Follow-up Actions</h2>
      <ul>
${followUpActions}
      </ul>
    </section>

    <section class="panel">
      <h2>Limitations</h2>
      <ul>
        <li>This report is not a formal validation opinion.</li>
        <li>This report is not a formal verification opinion.</li>
        <li>This is a scope-limited method review export, not a registry-ready verification report.</li>
        <li>Current Method Review exports are derived from local/browser-state review data where applicable.</li>
        <li>Missing evidence and missing project dossier fields remain unresolved unless they are explicitly packaged and reviewed.</li>
      </ul>
    </section>

    <section class="panel">
      <h2>Integrity Appendix</h2>
      <dl>
        <dt>Pack / export ID</dt><dd>${renderFieldValue(exportIdForDisplay(input.project), "Unavailable")}</dd>
        <dt>Manifest path</dt><dd>manifest.json</dd>
        <dt>Report path</dt><dd>${escapeHtml(input.trace.verification_contract.report_path)}</dd>
        <dt>Requirement review path</dt><dd>${escapeHtml(input.trace.verification_contract.requirement_review_path)}</dd>
        <dt>Evidence manifest path</dt><dd>${escapeHtml(input.trace.verification_contract.evidence_manifest_path)}</dd>
        <dt>Trace path</dt><dd>${escapeHtml(input.trace.verification_contract.project_path.replace("project.json", "trace.json"))}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Evidence ref</th>
            <th>Included file path</th>
            <th>SHA-256</th>
          </tr>
        </thead>
        <tbody>
${integrityRows}
        </tbody>
      </table>
    </section>
  </body>
</html>`;
}

function buildTrailEntries(input: {
  generatedAt: string;
  ruleCount: number;
  placeholder: boolean;
  mode: VerificationPackContract["trace"]["verification_contract"]["mode"];
  providedRefs: number;
  reviewedRules: number;
}): TrailEntry[] {
  const modeMeta =
    input.mode === "finalized_project_review_contract"
      ? { source: "finalized_review_artifact" }
      : input.mode === "current_method_review_contract"
        ? { source: "current_method_review" }
        : { source: "demo_placeholder" };
  return [
    {
      ts: input.generatedAt,
      actor: "system",
      action: "trail.init",
      meta: { schema: "v1", kind: "article6.audit_pack" },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.project_seeded",
      meta: { path: "project.json", placeholder: input.placeholder, ...modeMeta },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.evidence_manifest_seeded",
      meta: {
        path: "evidence-manifest.json",
        placeholder_refs: input.placeholder ? input.ruleCount : 0,
        provided_refs: input.providedRefs,
        placeholder: input.placeholder,
        ...modeMeta,
      },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.requirement_review_seeded",
      meta: {
        path: "requirement-review.json",
        placeholder_rules: input.placeholder ? input.ruleCount : 0,
        reviewed_rules: input.reviewedRules,
        placeholder: input.placeholder,
        ...modeMeta,
      },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.trace_updated",
      meta: { path: "trace.json", placeholder: false },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.report_derived",
      meta: {
        path: "VERIFICATION_REPORT.html",
        derived_from: ["project.json", "evidence-manifest.json", "requirement-review.json"],
      },
    },
  ];
}

export function buildVerificationPackContract(input: {
  generatedAt: string;
  methodCode: string;
  version: string;
  rulesJson: unknown;
  sectionsJson: unknown;
  trace: TraceIndex;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
  currentReview?: CurrentMethodReviewExportInput | null;
}): VerificationPackContract {
  const rules = extractRules(input.rulesJson);
  const sectionCount = extractSectionCount(input.sectionsJson);
  const finalizedArtifact = input.finalizedReview?.artifact ?? null;
  const finalizedPins = input.finalizedReview?.evidencePins ?? [];
  const currentReview = input.currentReview ?? null;
  const currentReviewPins = currentReview?.evidencePins ?? [];
  const currentReviewEntries = currentReview?.reviews ?? [];
  const currentVerifierBundle = currentReview?.verifierBundle ?? null;
  const finalizedRuleId = selectedRuleFromArtifact(finalizedArtifact);
  const finalizedEvidence = evidenceRefsForRule({
    ruleId: finalizedRuleId,
    artifact: finalizedArtifact,
    evidencePins: finalizedPins,
  });
  const hasFinalizedReview = Boolean(finalizedArtifact?.verifier?.finalizedState === "finalized" || finalizedArtifact?.verifier?.finalizedAt);
  const hasCurrentReview = !hasFinalizedReview && hasCurrentMethodReviewInput(currentReview);
  const mode: VerificationPackContract["trace"]["verification_contract"]["mode"] = hasFinalizedReview
    ? "finalized_project_review_contract"
    : hasCurrentReview
      ? "current_method_review_contract"
      : "demo_placeholder_review_contract";
  const reviewReason = hasFinalizedReview
    ? FINALIZED_REVIEW_REASON
    : hasCurrentReview
      ? CURRENT_METHOD_REVIEW_REASON
      : PLACEHOLDER_REASON;
  const reviewIndex = new Map<string, RuleReview>();
  for (const review of currentReviewEntries) {
    const rawRuleId = review.ruleId?.trim();
    if (rawRuleId && !reviewIndex.has(rawRuleId)) {
      reviewIndex.set(rawRuleId, review);
    }
    const canonicalRuleId = canonicalRuleKey(review.ruleId);
    if (canonicalRuleId && !reviewIndex.has(canonicalRuleId)) {
      reviewIndex.set(canonicalRuleId, review);
    }
  }

  const project: ProjectJson = {
    kind: "article6.verification_project",
    version: 1,
    generated_at: input.generatedAt,
    method: {
      code: input.methodCode,
      version: input.version,
      rule_count: rules.length,
      section_count: sectionCount,
    },
    pack_profile: {
      name: hasFinalizedReview ? "finalized_review_export" : hasCurrentReview ? "method_review_export" : "demo_verification_contract",
      human_label: hasFinalizedReview
        ? "Finalized review export"
        : hasCurrentReview
          ? "Method review export"
          : "Demo verification contract",
      disclaimer: hasFinalizedReview
        ? "This pack includes real methodology provenance plus an explicitly finalized local review artifact. It is not a formal verifier opinion."
        : hasCurrentReview
          ? "This pack reflects current local Method Review state. It remains draft/incomplete unless the supplied review state is explicitly finalized."
          : "This pack includes real methodology provenance plus a placeholder review scaffold. It does not assert a completed project verification.",
      not_a_formal_opinion: true,
    },
    project_context: {
      project_id: hasFinalizedReview || hasCurrentReview ? "not-supplied-in-method-review" : "local-method-review",
      export_id:
        finalizedArtifact?.verifier?.runId ??
        currentVerifierBundle?.runContext?.runId?.trim() ??
        currentVerifierBundle?.savedReviewerArtifactContext?.runId?.trim() ??
        "local-method-review",
      display_name: finalizedArtifact?.summary?.aoiLabel ?? (hasCurrentReview ? "Current method review workspace" : "Demo placeholder project context"),
      reporting_period: hasCurrentReview ? "not-supplied-in-method-review" : "placeholder-not-provided",
      location:
        finalizedArtifact?.summary?.aoiLabel ??
        (hasCurrentReview ? "Unavailable in local method review export" : "placeholder-not-provided"),
      description: hasFinalizedReview
        ? "Finalized local review context is included where present; absent project fields remain explicitly unavailable."
        : hasCurrentReview
          ? "Current browser Method Review state is included where available. Missing project dossier fields remain explicitly unavailable."
          : "Placeholder only: no project-specific context is included in this pack.",
      placeholder: !hasFinalizedReview && !hasCurrentReview,
      placeholder_reason:
        hasFinalizedReview || hasCurrentReview
          ? "Project registry dossier fields were not supplied to the audit-pack export."
          : PLACEHOLDER_REASON,
    },
    reviewer_assignment: {
      display_name:
        currentReviewEntries.find((review) => review.reviewedBy.trim())?.reviewedBy.trim() ||
        (hasFinalizedReview ? "Local reviewer artifact" : hasCurrentReview ? "Local method reviewer" : "Placeholder reviewer assignment"),
      role: hasFinalizedReview ? "Local review preparer" : hasCurrentReview ? "Method review contributor" : "VVB reviewer",
      organization: hasCurrentReview || hasFinalizedReview ? "Browser-local review state" : "Placeholder VVB organization",
      placeholder: !hasFinalizedReview && !hasCurrentReview,
      placeholder_reason:
        hasFinalizedReview || hasCurrentReview
          ? "No verified reviewer identity was supplied to the audit-pack export."
          : PLACEHOLDER_REASON,
    },
  };

  const evidence = hasFinalizedReview
    ? finalizedEvidence
    : hasCurrentReview
      ? mergeEvidenceManifestEntries(
          rules.flatMap((rule) => {
            const review = reviewIndex.get(rule.id) ?? reviewIndex.get(canonicalRuleKey(rule.id) ?? "") ?? null;
            return [
              ...evidenceRefsFromPinsForRule(rule.id, currentReviewPins, "current_method_review", "Current review evidence"),
              ...evidenceRefsFromCurrentReviewRecord(rule.id, review),
            ];
          }),
        )
      : rules.map<EvidenceManifestEntry>((rule) => ({
        evidence_ref: evidenceRefForRule(rule.id),
        label: `Placeholder project evidence request for ${rule.id}`,
        rule_ids: [rule.id],
        status: "not_provided",
        status_basis: "demo_placeholder",
        source_kind: "project_evidence_slot",
        included_in_pack: false,
        file_path: null,
        sha256: null,
        requested_for: summarizeRuleText(rule.text),
        placeholder: true,
        placeholder_reason: PLACEHOLDER_REASON,
      }));

  const evidenceManifest: EvidenceManifest = {
    kind: "article6.evidence_manifest",
    version: 1,
    generated_at: input.generatedAt,
    method: { code: input.methodCode, version: input.version },
    summary: {
      total_refs: evidence.length,
      provided_refs: evidence.filter((entry) => isPackagedEvidenceEntry(entry)).length,
      placeholder_refs: evidence.filter((entry) => entry.placeholder).length,
    },
    placeholder_policy: {
      all_entries_marked_placeholder: !hasFinalizedReview && !hasCurrentReview,
      reason: reviewReason,
    },
    evidence,
  };

  const placeholderRequirementRules = rules.map<RequirementReviewEntry>((rule) => {
    const traceSections = input.trace.rule_to_sections[rule.id] ?? [];
    return {
      rule_id: rule.id,
      status: "awaiting_project_evidence",
      status_basis: "demo_placeholder",
      rationale:
        "Placeholder only: this rule is scaffolded for review, but no project-specific evidence or reviewer action is included in the pack.",
      linked_evidence_refs: [],
      requested_evidence_refs: [evidenceRefForRule(rule.id)],
      reviewer: {
        display_name: "Placeholder reviewer assignment",
        role: "VVB reviewer",
        placeholder: true,
        placeholder_reason: PLACEHOLDER_REASON,
      },
      timestamps: {
        record_created_at: input.generatedAt,
        last_updated_at: input.generatedAt,
        reviewed_at: null,
      },
      methodology_trace: {
        section_ids: traceSections.map((section) => section.section_id),
      },
    };
  });

  const currentRequirementRules = rules.map<RequirementReviewEntry>((rule) => {
    const review = reviewIndex.get(rule.id) ?? reviewIndex.get(canonicalRuleKey(rule.id) ?? "") ?? null;
    const traceSections = input.trace.rule_to_sections[rule.id] ?? [];
    const linkedEvidenceRefs = evidenceRefsFromPinsForRule(
      rule.id,
      currentReviewPins,
      "current_method_review",
      "Current review evidence",
    ).map((entry) => entry.evidence_ref);
    const reviewerArtifact = reviewerArtifactForCurrentRule(rule.id, input.methodCode, input.version, currentVerifierBundle);
    const reviewedAt = pickLatestTimestamp([review?.reviewedAt, review?.updatedAt, reviewerArtifact?.finalized_at]);

    return {
      rule_id: rule.id,
      status:
        review?.status === "verified"
          ? "reviewed_verified"
          : review?.status === "not_verified"
            ? "reviewed_not_verified"
            : review?.status === "needs_followup"
              ? "reviewed_needs_followup"
              : "not_reviewed",
      status_basis: "current_method_review",
      rationale:
        review?.rationale?.trim() ||
        (review
          ? "A local review record exists for this rule, but no rationale text was supplied."
          : "No saved local review record exists for this rule yet."),
      linked_evidence_refs: linkedEvidenceRefs,
      requested_evidence_refs: requestedEvidenceRefsForCurrentReview(review),
      reviewer: {
        display_name: review?.reviewedBy?.trim() || "Local method reviewer",
        role: "Method review contributor",
        placeholder: false,
        placeholder_reason: "",
      },
      timestamps: {
        record_created_at: review?.reviewedAt || review?.updatedAt || input.generatedAt,
        last_updated_at: review?.updatedAt || review?.reviewedAt || input.generatedAt,
        reviewed_at: reviewedAt,
      },
      methodology_trace: {
        section_ids: traceSections.map((section) => section.section_id),
      },
      reconciliation: {
        status:
          review?.status === "verified"
            ? linkedEvidenceRefs.length || reviewerArtifact
              ? "Supported"
              : "Needs evidence"
            : review?.status === "not_verified"
              ? "Not supported"
              : review?.status === "needs_followup"
                ? "Needs follow-up"
                : null,
        reason:
          review?.status === "verified"
            ? "Current Method Review marks this rule as verified."
            : review?.status === "not_verified"
              ? "Current Method Review marks this rule as not verified."
              : review?.status === "needs_followup"
                ? "Current Method Review marks this rule for follow-up."
                : null,
      },
      reviewer_artifact: reviewerArtifact,
    };
  });

  const finalizedRequirementRules: RequirementReviewEntry[] = hasFinalizedReview
    ? [
        {
          rule_id: finalizedRuleId ?? "missing-finalized-rule-id",
          status: finalizedRuleId && finalizedEvidence.length ? "finalized" : "finalized_review_data_missing",
          status_basis: "finalized_project_review",
          rationale:
            finalizedArtifact?.summary?.narrative?.trim() ||
            finalizedArtifact?.verifier?.outcomeNote?.trim() ||
            "Finalized review artifact supplied, but no narrative or reviewer outcome note was available.",
          linked_evidence_refs: finalizedEvidence.map((entry) => entry.evidence_ref),
          requested_evidence_refs: [],
          reviewer: {
            display_name: "Local reviewer artifact",
            role: "Local review preparer",
            placeholder: false,
            placeholder_reason: "",
          },
          timestamps: {
            record_created_at: finalizedArtifact?.verifier?.createdAt ?? input.generatedAt,
            last_updated_at: finalizedArtifact?.verifier?.finalizedAt ?? input.generatedAt,
            reviewed_at: finalizedArtifact?.verifier?.finalizedAt ?? null,
          },
          methodology_trace: {
            section_ids: uniqueSorted([finalizedArtifact?.summary?.ruleSection ?? null]),
          },
          reconciliation: {
            status: finalizedArtifact?.summary?.reconciliationStatus ?? null,
            reason: finalizedArtifact?.summary?.reconciliationReason ?? null,
          },
          reviewer_artifact: {
            run_id: finalizedArtifact?.verifier?.runId ?? null,
            finalized_state: finalizedArtifact?.verifier?.finalizedState ?? null,
            finalized_at: finalizedArtifact?.verifier?.finalizedAt ?? null,
            minutes_present: Boolean(finalizedArtifact?.verifier?.minutes?.trim()),
            outcome_note: finalizedArtifact?.verifier?.outcomeNote?.trim() || finalizedArtifact?.summary?.outcomeNote || null,
          },
          stac_support_facts: stacSupportFactsForArtifact(finalizedArtifact),
        },
      ]
    : [];

  const requirementRules = hasFinalizedReview
    ? finalizedRequirementRules
    : hasCurrentReview
      ? currentRequirementRules
      : placeholderRequirementRules;

  const requirementReview: RequirementReview = {
    kind: "article6.requirement_review",
    version: 1,
    generated_at: input.generatedAt,
    method: { code: input.methodCode, version: input.version },
    summary: {
      total_rules: requirementRules.length,
      placeholder_rule_reviews: requirementRules.filter((rule) => rule.status_basis === "demo_placeholder").length,
      linked_evidence_refs: requirementRules.reduce((sum, rule) => sum + rule.linked_evidence_refs.length, 0),
    },
    placeholder_policy: {
      all_rule_reviews_marked_placeholder: !hasFinalizedReview && !hasCurrentReview,
      reason: reviewReason,
    },
    rules: requirementRules,
  };

  const ruleToEvidence = hasFinalizedReview
    ? Object.fromEntries(requirementRules.map((rule) => [rule.rule_id, [...rule.linked_evidence_refs]]))
    : hasCurrentReview
      ? Object.fromEntries(requirementRules.map((rule) => [rule.rule_id, [...rule.linked_evidence_refs]]))
    : Object.fromEntries(rules.map((rule) => [rule.id, [] as string[]]));
  const ruleToReview = Object.fromEntries(
    requirementRules.map((rule) => [
      rule.rule_id,
      {
        requirement_review_path: "requirement-review.json" as const,
        rule_id: rule.rule_id,
        status: rule.status,
        status_basis: rule.status_basis,
        linked_evidence_refs: [...rule.linked_evidence_refs],
        requested_evidence_refs: [...rule.requested_evidence_refs],
        placeholder: rule.status_basis === "demo_placeholder",
      },
    ]),
  );

  const trace = {
    ...input.trace,
    rule_to_evidence: ruleToEvidence,
    verification_contract: {
      mode,
      project_path: "project.json" as const,
      evidence_manifest_path: "evidence-manifest.json" as const,
      requirement_review_path: "requirement-review.json" as const,
      trail_path: "trail.jsonl" as const,
      report_path: "VERIFICATION_REPORT.html" as const,
      placeholder: !hasFinalizedReview && !hasCurrentReview,
      placeholder_reason: reviewReason,
    },
    rule_to_review: ruleToReview,
  };

  const trailEntries = buildTrailEntries({
    generatedAt: input.generatedAt,
    ruleCount: rules.length,
    placeholder: !hasFinalizedReview && !hasCurrentReview,
    mode,
    providedRefs: evidenceManifest.summary.provided_refs,
    reviewedRules: requirementRules.filter((rule) => rule.status !== "not_reviewed" && rule.status !== "awaiting_project_evidence").length,
  });

  const reportHtml = renderVerificationReportHtml({
    mode,
    project,
    evidenceManifest,
    requirementReview,
    trace,
  });

  return { project, evidenceManifest, requirementReview, trace, trailEntries, reportHtml };
}

export function buildVerificationPackContractFiles(input: {
  generatedAt: string;
  methodCode: string;
  version: string;
  rulesJson: unknown;
  sectionsJson: unknown;
  trace: TraceIndex;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
  currentReview?: CurrentMethodReviewExportInput | null;
}): Array<{ path: string; bytes: Buffer }> {
  const contract = buildVerificationPackContract(input);
  return [
    {
      path: "project.json",
      bytes: Buffer.from(canonicalStringify(contract.project), "utf8"),
    },
    {
      path: "evidence-manifest.json",
      bytes: Buffer.from(canonicalStringify(contract.evidenceManifest), "utf8"),
    },
    {
      path: "requirement-review.json",
      bytes: Buffer.from(canonicalStringify(contract.requirementReview), "utf8"),
    },
    {
      path: "trace.json",
      bytes: Buffer.from(canonicalStringify(contract.trace), "utf8"),
    },
    {
      path: "trail.jsonl",
      bytes: Buffer.from(contract.trailEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8"),
    },
    {
      path: "VERIFICATION_REPORT.html",
      bytes: Buffer.from(contract.reportHtml, "utf8"),
    },
  ];
}

export type { EvidenceManifest, ProjectJson, RequirementReview, VerificationPackContract, TraceSectionLink };
