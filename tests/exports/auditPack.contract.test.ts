import { describe, expect, test } from "@jest/globals";
import { strFromU8, unzipSync } from "fflate";
import { buildAuditPackZip } from "@/exports/auditPack";
import { buildVerificationPackContractFiles } from "@/exports/verificationPackContract";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "@/lib/proofMap/types";

describe("audit pack verification contract", () => {
  test("includes demo-safe verification contract files without requiring methodology checkout", async () => {
    const files = buildVerificationPackContractFiles({
      generatedAt: "2026-04-23T00:00:00.000Z",
      methodCode: "AR-ACM0003",
      version: "v02-0",
      rulesJson: {
        rules: [
          { id: "R-1-0001", text: "Submit a monitoring report for the reporting period." },
          { rule_id: "R-1-0002", text: "Provide supporting baseline calculations." },
        ],
      },
      sectionsJson: {
        sections: [
          { id: "S-1", title: "Monitoring" },
          { id: "S-2", title: "Baseline" },
        ],
      },
      trace: {
        version: 1,
        method: { code: "AR-ACM0003", version: "v02-0" },
        rule_to_sections: {
          "R-1-0001": [{ section_id: "S-1", title: "Monitoring", anchor: "#S-1", match: "explicit" }],
          "R-1-0002": [{ section_id: "S-2", title: "Baseline", anchor: "#S-2", match: "explicit" }],
        },
        rule_to_evidence: {},
      },
    });

    const fileMap = new Map(
      files.map((file) => [file.path, file.bytes.toString("utf8")]),
    );

    const requiredFiles = [
      "project.json",
      "evidence-manifest.json",
      "requirement-review.json",
      "trace.json",
      "trail.jsonl",
      "VERIFICATION_REPORT.html",
    ];

    for (const path of requiredFiles) {
      expect(fileMap.has(path)).toBe(true);
    }

    const project = JSON.parse(fileMap.get("project.json")!) as {
      pack_profile: { name: string; not_a_formal_opinion: boolean };
      project_context: { placeholder: boolean; placeholder_reason: string };
      reviewer_assignment: { placeholder: boolean };
    };
    expect(project.pack_profile.name).toBe("demo_verification_contract");
    expect(project.pack_profile.not_a_formal_opinion).toBe(true);
    expect(project.project_context.placeholder).toBe(true);
    expect(project.project_context.placeholder_reason).toMatch(/project-specific evidence/i);
    expect(project.reviewer_assignment.placeholder).toBe(true);

    const evidenceManifest = JSON.parse(fileMap.get("evidence-manifest.json")!) as {
      summary: { total_refs: number; provided_refs: number; placeholder_refs: number };
      evidence: Array<{ sha256: string | null; included_in_pack: boolean; placeholder: boolean }>;
    };
    expect(evidenceManifest.summary.total_refs).toBeGreaterThan(0);
    expect(evidenceManifest.summary.provided_refs).toBe(0);
    expect(evidenceManifest.summary.placeholder_refs).toBe(evidenceManifest.summary.total_refs);
    expect(evidenceManifest.evidence.every((entry) => entry.included_in_pack === false)).toBe(true);
    expect(evidenceManifest.evidence.every((entry) => entry.sha256 === null)).toBe(true);
    expect(evidenceManifest.evidence.every((entry) => entry.placeholder === true)).toBe(true);

    const requirementReview = JSON.parse(fileMap.get("requirement-review.json")!) as {
      summary: { total_rules: number; placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{
        rule_id: string;
        status: string;
        status_basis: string;
        linked_evidence_refs: string[];
        requested_evidence_refs: string[];
        reviewer: { placeholder: boolean };
        timestamps: { reviewed_at: string | null };
      }>;
    };
    expect(requirementReview.summary.total_rules).toBe(2);
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(2);
    expect(requirementReview.summary.linked_evidence_refs).toBe(0);
    expect(requirementReview.rules.every((rule) => rule.status === "awaiting_project_evidence")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.status_basis === "demo_placeholder")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.linked_evidence_refs.length === 0)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.requested_evidence_refs.length === 1)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.reviewer.placeholder === true)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.timestamps.reviewed_at === null)).toBe(true);

    const trace = JSON.parse(fileMap.get("trace.json")!) as {
      verification_contract: { mode: string; report_path: string; placeholder: boolean };
      rule_to_review: Record<string, { status: string; requested_evidence_refs: string[] }>;
      rule_to_evidence: Record<string, string[]>;
    };
    expect(trace.verification_contract.mode).toBe("demo_placeholder_review_contract");
    expect(trace.verification_contract.report_path).toBe("VERIFICATION_REPORT.html");
    expect(trace.verification_contract.placeholder).toBe(true);
    expect(trace.rule_to_review["R-1-0001"]?.status).toBe("awaiting_project_evidence");
    expect(trace.rule_to_review["R-1-0001"]?.requested_evidence_refs).toHaveLength(1);
    expect(trace.rule_to_review["R-1-0002"]?.status).toBe("awaiting_project_evidence");
    expect(trace.rule_to_evidence["R-1-0001"]).toEqual([]);

    const reportHtml = fileMap.get("VERIFICATION_REPORT.html")!;
    expect(reportHtml).toContain("Demo review record only.");
    expect(reportHtml).toContain("not a formal verifier opinion");
    expect(reportHtml).toContain("R-1-0001");
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
        checklist: [
          { id: "read-overview", label: "Read method overview", checked: true, updatedAt: "2026-04-24T11:55:00.000Z" },
        ],
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
        pdd_fragments: [
          {
            evidence_id: "pin-pdd-1",
            fragment_id: "frag-monitoring-period",
            label: "Monitoring period",
            page_start: 12,
            excerpt: "Monitoring period evidence.",
          },
        ],
        pdd_fragment_links: [
          {
            fragment_id: "frag-monitoring-period",
            rule_id: "R-1-0001",
            linked_at: "2026-04-24T11:57:00.000Z",
          },
        ],
      },
    ];

    const zip = buildAuditPackZip("AR-ACM0003", "v02-0", { finalizedReview: { artifact, evidencePins } });
    const entries = unzipSync(new Uint8Array(zip));
    const readJson = (path: string) => JSON.parse(strFromU8(entries[path]));

    const manifest = readJson("manifest.json") as { generated_at: string };
    expect(manifest.generated_at).toBe("2026-04-24T12:00:00.000Z");
    expect(manifest.generated_at).not.toBe("1970-01-01T00:00:00.000Z");

    const trace = readJson("trace.json") as {
      verification_contract: { mode: string; placeholder: boolean };
      rule_to_review: Record<string, { status: string; status_basis: string; linked_evidence_refs: string[] }>;
    };
    expect(trace.verification_contract).toMatchObject({
      mode: "finalized_project_review_contract",
      placeholder: false,
    });
    expect(trace.rule_to_review["R-1-0001"]).toMatchObject({
      status: "finalized",
      status_basis: "finalized_project_review",
      linked_evidence_refs: expect.arrayContaining(["sentinel-scene-1", "frag-monitoring-period"]),
    });

    const requirementReview = readJson("requirement-review.json") as {
      summary: { placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{
        rule_id: string;
        status: string;
        status_basis: string;
        linked_evidence_refs: string[];
        reconciliation?: { status: string | null; reason: string | null };
        reviewer_artifact?: { finalized_state: string | null; outcome_note: string | null };
      }>;
    };
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(0);
    expect(requirementReview.summary.linked_evidence_refs).toBeGreaterThanOrEqual(2);
    expect(requirementReview.rules).toHaveLength(1);
    expect(requirementReview.rules[0]).toMatchObject({
      rule_id: "R-1-0001",
      status: "finalized",
      status_basis: "finalized_project_review",
      reconciliation: {
        status: "Supported",
        reason: "All expected evidence is linked and reviewer artifact is saved.",
      },
      reviewer_artifact: {
        finalized_state: "finalized",
        outcome_note: "Ready for external review.",
      },
    });
    expect(requirementReview.rules[0].linked_evidence_refs).toEqual(
      expect.arrayContaining(["sentinel-scene-1", "frag-monitoring-period"]),
    );
    expect(JSON.stringify(requirementReview)).not.toContain("awaiting_project_evidence");

    const evidenceManifest = readJson("evidence-manifest.json") as {
      summary: { provided_refs: number; placeholder_refs: number };
      evidence: Array<{ evidence_ref: string; status: string; fragment_id?: string; placeholder: boolean }>;
    };
    expect(evidenceManifest.summary.provided_refs).toBeGreaterThanOrEqual(2);
    expect(evidenceManifest.summary.placeholder_refs).toBe(0);
    expect(evidenceManifest.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_ref: "sentinel-scene-1", status: "provided", placeholder: false }),
        expect.objectContaining({
          evidence_ref: "frag-monitoring-period",
          status: "provided",
          fragment_id: "frag-monitoring-period",
          placeholder: false,
        }),
      ]),
    );
    expect(JSON.stringify(evidenceManifest)).not.toContain("awaiting_project_evidence");
  });
});
