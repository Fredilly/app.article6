import { canonicalStringify } from "../integrity/artifacts";
import type { TraceIndex, TraceSectionLink } from "../lib/trace/traceIndex";

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
    name: "demo_verification_contract";
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
    placeholder: true;
    placeholder_reason: string;
  };
  reviewer_assignment: {
    display_name: string;
    role: string;
    organization: string;
    placeholder: true;
    placeholder_reason: string;
  };
};

type EvidenceManifestEntry = {
  evidence_ref: string;
  label: string;
  rule_ids: string[];
  status: "not_provided";
  status_basis: "demo_placeholder";
  source_kind: "project_evidence_slot";
  included_in_pack: false;
  file_path: null;
  sha256: null;
  requested_for: string;
  placeholder: true;
  placeholder_reason: string;
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
    all_entries_marked_placeholder: true;
    reason: string;
  };
  evidence: EvidenceManifestEntry[];
};

type RequirementReviewEntry = {
  rule_id: string;
  status: "awaiting_project_evidence";
  status_basis: "demo_placeholder";
  rationale: string;
  linked_evidence_refs: string[];
  requested_evidence_refs: string[];
  reviewer: {
    display_name: string;
    role: string;
    placeholder: true;
    placeholder_reason: string;
  };
  timestamps: {
    record_created_at: string;
    last_updated_at: string;
    reviewed_at: null;
  };
  methodology_trace: {
    section_ids: string[];
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
    all_rule_reviews_marked_placeholder: true;
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
      mode: "demo_placeholder_review_contract";
      project_path: "project.json";
      evidence_manifest_path: "evidence-manifest.json";
      requirement_review_path: "requirement-review.json";
      trail_path: "trail.jsonl";
      report_path: "VERIFICATION_REPORT.html";
      placeholder: true;
      placeholder_reason: string;
    };
    rule_to_review: Record<
      string,
      {
        requirement_review_path: "requirement-review.json";
        rule_id: string;
        status: "awaiting_project_evidence";
        linked_evidence_refs: string[];
        requested_evidence_refs: string[];
        placeholder: true;
      }
    >;
  };
  trailEntries: TrailEntry[];
  reportHtml: string;
};

const PLACEHOLDER_REASON =
  "Real project-specific evidence, reviewer assignment, and verification outcomes are not available in this methodology-only demo contract.";

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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Demo Verification Review Record</title>
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
      <strong>Demo review record only.</strong>
      <div>This HTML is derived from <code>project.json</code>, <code>evidence-manifest.json</code>, and <code>requirement-review.json</code>. It is not a formal verifier opinion.</div>
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

    <h2>Requirement Review Scaffold</h2>
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
}): TrailEntry[] {
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
      meta: { path: "project.json", placeholder: true },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.evidence_manifest_seeded",
      meta: { path: "evidence-manifest.json", placeholder_refs: input.ruleCount, placeholder: true },
    },
    {
      ts: input.generatedAt,
      actor: "system",
      action: "verification_contract.requirement_review_seeded",
      meta: { path: "requirement-review.json", placeholder_rules: input.ruleCount, placeholder: true },
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
}): VerificationPackContract {
  const rules = extractRules(input.rulesJson);
  const sectionCount = extractSectionCount(input.sectionsJson);

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
      name: "demo_verification_contract",
      human_label: "Demo verification contract",
      disclaimer:
        "This pack includes real methodology provenance plus a placeholder review scaffold. It does not assert a completed project verification.",
      not_a_formal_opinion: true,
    },
    project_context: {
      project_id: "demo-placeholder-project",
      display_name: "Demo placeholder project context",
      reporting_period: "placeholder-not-provided",
      location: "placeholder-not-provided",
      description: "Placeholder only: no project-specific context is included in this pack.",
      placeholder: true,
      placeholder_reason: PLACEHOLDER_REASON,
    },
    reviewer_assignment: {
      display_name: "Placeholder reviewer assignment",
      role: "VVB reviewer",
      organization: "Placeholder VVB organization",
      placeholder: true,
      placeholder_reason: PLACEHOLDER_REASON,
    },
  };

  const evidence = rules.map<EvidenceManifestEntry>((rule) => ({
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
      provided_refs: 0,
      placeholder_refs: evidence.length,
    },
    placeholder_policy: {
      all_entries_marked_placeholder: true,
      reason: PLACEHOLDER_REASON,
    },
    evidence,
  };

  const requirementRules = rules.map<RequirementReviewEntry>((rule) => {
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

  const requirementReview: RequirementReview = {
    kind: "article6.requirement_review",
    version: 1,
    generated_at: input.generatedAt,
    method: { code: input.methodCode, version: input.version },
    summary: {
      total_rules: requirementRules.length,
      placeholder_rule_reviews: requirementRules.length,
      linked_evidence_refs: 0,
    },
    placeholder_policy: {
      all_rule_reviews_marked_placeholder: true,
      reason: PLACEHOLDER_REASON,
    },
    rules: requirementRules,
  };

  const ruleToEvidence = Object.fromEntries(rules.map((rule) => [rule.id, [] as string[]]));
  const ruleToReview = Object.fromEntries(
    requirementRules.map((rule) => [
      rule.rule_id,
      {
        requirement_review_path: "requirement-review.json" as const,
        rule_id: rule.rule_id,
        status: rule.status,
        linked_evidence_refs: rule.linked_evidence_refs,
        requested_evidence_refs: rule.requested_evidence_refs,
        placeholder: true as const,
      },
    ]),
  );

  const trace = {
    ...input.trace,
    rule_to_evidence: ruleToEvidence,
    verification_contract: {
      mode: "demo_placeholder_review_contract" as const,
      project_path: "project.json" as const,
      evidence_manifest_path: "evidence-manifest.json" as const,
      requirement_review_path: "requirement-review.json" as const,
      trail_path: "trail.jsonl" as const,
      report_path: "VERIFICATION_REPORT.html" as const,
      placeholder: true as const,
      placeholder_reason: PLACEHOLDER_REASON,
    },
    rule_to_review: ruleToReview,
  };

  const trailEntries = buildTrailEntries({
    generatedAt: input.generatedAt,
    ruleCount: rules.length,
  });

  const reportHtml = renderVerificationReportHtml({
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
