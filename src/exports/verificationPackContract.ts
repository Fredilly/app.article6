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
        status: "provided",
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
        status: "provided",
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
    review.evidenceLink,
    ...review.evidenceAttachments.map((attachment) => attachment.label || attachment.id),
  ]);
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
      status: "provided",
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

function renderVerificationReportHtml(input: {
  mode: VerificationPackContract["trace"]["verification_contract"]["mode"];
  project: ProjectJson;
  evidenceManifest: EvidenceManifest;
  requirementReview: RequirementReview;
}): string {
  const rows = input.requirementReview.rules
    .map((rule) => {
      const requested = rule.requested_evidence_refs.join(", ") || "None";
      return `<tr>
  <td>${escapeHtml(rule.rule_id)}</td>
  <td>${escapeHtml(rule.status)}</td>
  <td>${escapeHtml(rule.status_basis)}</td>
  <td>${escapeHtml(requested)}</td>
  <td>${escapeHtml(rule.rationale)}</td>
</tr>`;
    })
    .join("\n");

  const bannerTitle =
    input.mode === "finalized_project_review_contract"
      ? "Finalized local review export."
      : input.mode === "current_method_review_contract"
        ? "Draft / incomplete local method review export."
        : "Demo review record only.";
  const bannerBody =
    input.mode === "finalized_project_review_contract"
      ? "This HTML is derived from current methodology data plus an explicitly finalized local review artifact."
      : input.mode === "current_method_review_contract"
        ? "This HTML is derived from current browser Method Review state. It does not claim a finalized verifier opinion unless the supplied review state is explicitly finalized."
        : "This HTML is derived from project.json, evidence-manifest.json, and requirement-review.json. It is not a formal verifier opinion.";
  const reportTitle =
    input.mode === "finalized_project_review_contract"
      ? "Finalized Verification Review Record"
      : input.mode === "current_method_review_contract"
        ? "Method Review Draft Export"
        : "Demo Verification Review Record";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportTitle)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; color: #0f172a; line-height: 1.5; }
      .banner { border: 1px solid #f59e0b; background: #fffbeb; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
      h1, h2 { margin-bottom: 8px; }
      p, li { color: #334155; }
      code { background: #f8fafc; padding: 2px 6px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
    </style>
  </head>
  <body>
    <div class="banner">
      <strong>${escapeHtml(bannerTitle)}</strong>
      <div>${escapeHtml(bannerBody)}</div>
    </div>
    <h1>${escapeHtml(input.project.method.code)} ${escapeHtml(input.project.method.version)}</h1>
    <p>${escapeHtml(input.project.pack_profile.disclaimer)}</p>

    <h2>Project Context</h2>
    <p><strong>${escapeHtml(input.project.project_context.display_name)}</strong></p>
    <p>${escapeHtml(input.project.project_context.description)}</p>

    <h2>Evidence Inventory</h2>
    <p>
      Total refs: ${input.evidenceManifest.summary.total_refs} |
      Provided refs: ${input.evidenceManifest.summary.provided_refs} |
      Placeholder refs: ${input.evidenceManifest.summary.placeholder_refs}
    </p>

    <h2>Requirement Review</h2>
    <table>
      <thead>
        <tr>
          <th>Rule</th>
          <th>Status</th>
          <th>Basis</th>
          <th>Requested Evidence Refs</th>
          <th>Rationale</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
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
      project_id:
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
      ? uniqueSorted(rules.flatMap((rule) => evidenceRefsFromPinsForRule(rule.id, currentReviewPins, "current_method_review", "Current review evidence").map((entry) => entry.evidence_ref)))
          .map((ref) =>
            rules
              .flatMap((rule) => evidenceRefsFromPinsForRule(rule.id, currentReviewPins, "current_method_review", "Current review evidence"))
              .find((entry) => entry.evidence_ref === ref),
          )
          .filter((entry): entry is EvidenceManifestEntry => Boolean(entry))
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
      provided_refs: evidence.filter((entry) => entry.status === "provided").length,
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
