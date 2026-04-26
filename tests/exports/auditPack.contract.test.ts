import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { buildAuditPackZip } from "@/exports/auditPack";
import { buildVerificationPackContractFiles } from "@/exports/verificationPackContract";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "@/lib/proofMap/types";
import type { RuleReview } from "@/lib/verify/reviewStore";

const rulesJson = {
  rules: [
    { id: "R-1-0001", text: "Submit a monitoring report for the reporting period." },
    { id: "R-1-0002", text: "Provide supporting baseline calculations." },
  ],
};

const sectionsJson = {
  sections: [
    { id: "S-1", title: "Monitoring", anchor: "#S-1" },
    { id: "S-2", title: "Baseline", anchor: "#S-2" },
  ],
};

const trace = {
  version: 1,
  method: { code: "AR-ACM0003", version: "v02-0" },
  rule_to_sections: {
    "R-1-0001": [{ section_id: "S-1", title: "Monitoring", anchor: "#S-1", match: "explicit" }],
    "R-1-0002": [{ section_id: "S-2", title: "Baseline", anchor: "#S-2", match: "explicit" }],
  },
  rule_to_evidence: {},
} as const;

function withTemporaryMethodologyCheckout<T>(callback: () => T): T {
  const previousCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article6-audit-pack-"));
  const methodDir = path.join(root, "public", "methodologies", "UNFCCC", "Forestry", "AR-ACM0003", "v02-0");

  fs.mkdirSync(methodDir, { recursive: true });
  fs.writeFileSync(
    path.join(methodDir, "META.json"),
    JSON.stringify({ code: "AR-ACM0003", version: "v02-0", title: "Temporary test methodology" }),
  );
  fs.writeFileSync(path.join(methodDir, "rules.json"), JSON.stringify(rulesJson));
  fs.writeFileSync(path.join(methodDir, "sections.json"), JSON.stringify(sectionsJson));
  fs.writeFileSync(path.join(methodDir, "rules.rich.json"), JSON.stringify(rulesJson));
  fs.writeFileSync(path.join(methodDir, "sections.rich.json"), JSON.stringify(sectionsJson));

  try {
    process.chdir(root);
    return callback();
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("audit pack verification contract", () => {
  test("includes truthful demo-safe fallback contract files", () => {
    const files = buildVerificationPackContractFiles({
      generatedAt: "2026-04-23T00:00:00.000Z",
      methodCode: "AR-ACM0003",
      version: "v02-0",
      rulesJson,
      sectionsJson,
      trace,
    });
    const fileMap = new Map(files.map((file) => [file.path, file.bytes.toString("utf8")]));

    for (const required of ["project.json", "evidence-manifest.json", "requirement-review.json", "trace.json", "trail.jsonl", "VERIFICATION_REPORT.html"]) {
      expect(fileMap.has(required)).toBe(true);
    }

    const requirementReview = JSON.parse(fileMap.get("requirement-review.json")!) as {
      summary: { total_rules: number; placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{ status: string; status_basis: string; linked_evidence_refs: string[] }>;
    };
    expect(requirementReview.summary).toMatchObject({
      total_rules: 2,
      placeholder_rule_reviews: 2,
      linked_evidence_refs: 0,
    });
    expect(requirementReview.rules.every((rule) => rule.status === "awaiting_project_evidence")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.status_basis === "demo_placeholder")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.linked_evidence_refs.length === 0)).toBe(true);

    const evidenceManifest = JSON.parse(fileMap.get("evidence-manifest.json")!) as {
      summary: { provided_refs: number; placeholder_refs: number };
    };
    expect(evidenceManifest.summary.provided_refs).toBe(0);
    expect(evidenceManifest.summary.placeholder_refs).toBe(2);

    expect(fileMap.get("VERIFICATION_REPORT.html")).toContain("not a formal verifier opinion");
  });

  test("uses finalized review artifact and linked evidence in audit-pack zip when supplied", () => {
    const artifact: EvidenceSnapshot = {
      method: { code: "AR-ACM0003", version: "v02-0" },
      evidence_source: { type: "stac_url", ref: "https://stac.example.test" },
      selected: {
        id: "sentinel-scene-1",
        item: {
          id: "sentinel-scene-1",
          datetime: "2026-04-20T00:00:00Z",
          collection: "sentinel-2",
          cloud_cover: 3,
          linked_rules: ["R-1-0001"],
        },
      },
      outcome: {
        aoi: { hash: "aoi-hash", bbox: [1, 2, 3, 4], areaKm2: 12 },
        stac: { query: { source: "https://stac.example.test" }, itemIds: ["sentinel-scene-1"] },
        linkage: { selectedRuleId: "R-1-0001", linkedRuleIds: ["R-1-0001"] },
        exportState: { snapshotExportedAt: "2026-04-24T12:00:00.000Z" },
        provenance: {
          methodCode: "AR-ACM0003",
          version: "v02-0",
          generatedAt: "2026-04-24T12:00:00.000Z",
          snapshotSchemaVersion: "evidence-snapshot/v2",
        },
      },
      verifier: {
        runId: "run-final-1",
        createdAt: "2026-04-24T11:50:00.000Z",
        minutes: "Reviewer checked selected satellite evidence and PDD fragment.",
        outcomeNote: "Ready for external review.",
        finalizedAt: "2026-04-24T12:00:00.000Z",
        finalizedState: "finalized",
        delta: "",
        impact: "",
        checklistStatus: "2/2 completed",
        checklist: [{ id: "read-overview", label: "Read method overview", checked: true, updatedAt: "2026-04-24T11:55:00.000Z" }],
        tasks: [],
      },
      kpis: {
        stacSearchResultCount: 1,
        selectedEvidenceCount: 1,
        linkedRuleCount: 1,
        coverage: { numerator: 1, denominator: 2 },
        snapshotExportedAt: "2026-04-24T12:00:00.000Z",
      },
      summary: {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        ruleId: "R-1-0001",
        ruleSection: "Monitoring",
        ruleText: "Submit a monitoring report for the reporting period.",
        selectedEvidenceId: "sentinel-scene-1",
        selectedEvidenceDatetime: "2026-04-20T00:00:00Z",
        cloudCover: 3,
        aoiLabel: "Demo AOI",
        reviewState: "finalized",
        generatedAt: "2026-04-24T12:00:00.000Z",
        outcomeNote: "Ready for external review.",
        stacSearchResultCount: 1,
        linkedRuleCount: 1,
        selectedEvidenceLinkedRules: ["R-1-0001"],
        checklistStatus: "2/2 completed",
        reconciliationStatus: "Supported",
        reconciliationReason: "All expected evidence is linked and reviewer artifact is saved.",
        narrative: "Finalized verify review. Rule R-1-0001. Selected evidence sentinel-scene-1 linked to R-1-0001.",
      },
    };
    const evidencePins: EvidencePin[] = [
      {
        id: "pin-scene-1",
        kind: "note",
        title: "sentinel-scene-1",
        ruleId: "R-1-0001",
        itemId: "sentinel-scene-1",
        cited_ids: ["R-1-0001"],
        stac_item_ids: ["sentinel-scene-1"],
        created_at: "2026-04-24T11:54:00.000Z",
      },
      {
        id: "pin-pdd-1",
        kind: "pdd",
        title: "PDD.pdf",
        cited_ids: [],
        created_at: "2026-04-24T11:56:00.000Z",
        pdd_fragments: [{ evidence_id: "pin-pdd-1", fragment_id: "frag-monitoring-period", label: "Monitoring period", page_start: 12 }],
        pdd_fragment_links: [{ fragment_id: "frag-monitoring-period", rule_id: "R-1-0001", linked_at: "2026-04-24T11:57:00.000Z" }],
      },
    ];

    const zip = withTemporaryMethodologyCheckout(() =>
      buildAuditPackZip("AR-ACM0003", "v02-0", { finalizedReview: { artifact, evidencePins } }),
    );
    const entries = unzipSync(new Uint8Array(zip));
    const readJson = (entry: string) => JSON.parse(strFromU8(entries[entry]));

    const manifest = readJson("manifest.json") as { generated_at: string };
    expect(manifest.generated_at).toBe("2026-04-24T12:00:00.000Z");
    expect(manifest.generated_at).not.toBe("1970-01-01T00:00:00.000Z");

    const requirementReview = readJson("requirement-review.json") as {
      summary: { placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{ linked_evidence_refs: string[]; reconciliation?: { status: string | null }; reviewer_artifact?: { outcome_note: string | null } }>;
    };
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(0);
    expect(requirementReview.summary.linked_evidence_refs).toBeGreaterThanOrEqual(2);
    expect(requirementReview.rules).toHaveLength(1);
    expect(requirementReview.rules[0].linked_evidence_refs).toEqual(expect.arrayContaining(["sentinel-scene-1", "frag-monitoring-period"]));
    expect(requirementReview.rules[0].reconciliation?.status).toBe("Supported");
    expect(requirementReview.rules[0].reviewer_artifact?.outcome_note).toBe("Ready for external review.");
    expect(JSON.stringify(requirementReview)).not.toContain("awaiting_project_evidence");

    const evidenceManifest = readJson("evidence-manifest.json") as {
      summary: { provided_refs: number; placeholder_refs: number };
      evidence: Array<{ evidence_ref: string; status: string; placeholder: boolean }>;
    };
    expect(evidenceManifest.summary.provided_refs).toBeGreaterThanOrEqual(2);
    expect(evidenceManifest.summary.placeholder_refs).toBe(0);
    expect(evidenceManifest.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_ref: "sentinel-scene-1", status: "provided", placeholder: false }),
        expect.objectContaining({ evidence_ref: "frag-monitoring-period", status: "provided", placeholder: false }),
      ]),
    );
    expect(JSON.stringify(evidenceManifest)).not.toContain("awaiting_project_evidence");
  });

  test("uses current Method Review state for non-finalized exports instead of demo placeholders", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "R-1-0001",
        methodology: "AR-ACM0003",
        version: "v02-0",
        status: "verified",
        rationale: "Linked STAC evidence supports the monitoring requirement.",
        supportReference: "scene-1",
        evidenceLink: "scene-1",
        evidenceAttachments: [],
        reviewedBy: "Verifier A",
        reviewedAt: "2026-04-24T11:58:00.000Z",
        updatedAt: "2026-04-24T11:58:00.000Z",
      },
    ];
    const evidencePins: EvidencePin[] = [
      {
        id: "pin-scene-1",
        kind: "note",
        title: "scene-1",
        ruleId: "R-1-0001",
        itemId: "scene-1",
        cited_ids: ["R-1-0001"],
        stac_item_ids: ["scene-1"],
        created_at: "2026-04-24T11:55:00.000Z",
      },
    ];

    const zip = withTemporaryMethodologyCheckout(() =>
      buildAuditPackZip("AR-ACM0003", "v02-0", {
        currentReview: {
          latestReviewAt: "2026-04-24T12:05:00.000Z",
          reviews,
          evidencePins,
          verifierBundle: {
            runContext: {
              runId: "run-draft-1",
              createdAt: "2026-04-24T11:45:00.000Z",
            },
            savedReviewerArtifactAt: "2026-04-24T12:05:00.000Z",
            finalizedAt: null,
            minutes: "Reviewer minutes",
            outcomeNote: "Draft outcome note",
            savedReviewerArtifactContext: {
              methodCode: "AR-ACM0003",
              version: "v02-0",
              ruleId: "R-1-0001",
              runId: "run-draft-1",
            },
          },
        },
      }),
    );
    const entries = unzipSync(new Uint8Array(zip));
    const readJson = (entry: string) => JSON.parse(strFromU8(entries[entry]));

    const manifest = readJson("manifest.json") as { generated_at: string };
    expect(manifest.generated_at).toBe("2026-04-24T12:05:00.000Z");
    expect(manifest.generated_at).not.toBe("1970-01-01T00:00:00.000Z");

    const project = readJson("project.json") as { pack_profile: { human_label: string; disclaimer: string } };
    expect(project.pack_profile.human_label).toBe("Method review export");
    expect(project.pack_profile.disclaimer).toContain("draft/incomplete");
    expect(project.pack_profile.disclaimer).not.toContain("placeholder review scaffold");

    const requirementReview = readJson("requirement-review.json") as {
      summary: { placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{
        rule_id: string;
        status: string;
        status_basis: string;
        rationale: string;
        linked_evidence_refs: string[];
        reviewer_artifact?: { outcome_note: string | null };
      }>;
    };
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(0);
    expect(requirementReview.summary.linked_evidence_refs).toBeGreaterThanOrEqual(1);
    expect(requirementReview.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule_id: "R-1-0001",
          status: "reviewed_verified",
          status_basis: "current_method_review",
          rationale: "Linked STAC evidence supports the monitoring requirement.",
          linked_evidence_refs: expect.arrayContaining(["scene-1"]),
          reviewer_artifact: expect.objectContaining({
            outcome_note: "Draft outcome note",
          }),
        }),
      ]),
    );

    const trace = readJson("trace.json") as {
      verification_contract: { mode: string; placeholder: boolean };
    };
    expect(trace.verification_contract.mode).toBe("current_method_review_contract");
    expect(trace.verification_contract.placeholder).toBe(false);

    expect(strFromU8(entries["VERIFICATION_REPORT.html"])).toContain("Draft / incomplete local method review export.");
    expect(strFromU8(entries["VERIFICATION_REPORT.html"])).not.toContain("Demo review record only.");
  });
});
