import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { buildAuditPackZip } from "@/exports/auditPack";
import { buildVerificationPackContractFiles } from "@/exports/verificationPackContract";
import { sha256Hex } from "@/integrity/artifacts";
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

const readinessSkeletonRulesJson = {
  rules: [
    { id: "R-1-0001", text: "Submit monitoring and boundary reconciliation evidence for the reporting period." },
    { id: "R-1-0002", text: "Provide supporting baseline calculations." },
    { id: "R-1-0003", text: "Provide eligibility support evidence." },
    { id: "R-1-0004", text: "Document monitoring period coverage." },
    { id: "R-1-0005", text: "Document QA/QC review steps." },
    { id: "R-1-0006", text: "Document activity data sources." },
    { id: "R-1-0007", text: "Document parameter derivation support." },
    { id: "R-1-0008", text: "Document project boundary support references." },
  ],
};

const readinessSkeletonSectionsJson = {
  sections: [
    { id: "S-1", title: "Monitoring", anchor: "#S-1" },
    { id: "S-2", title: "Boundary", anchor: "#S-2" },
  ],
};

const arAms0007RulesJson = {
  rules: [
    { id: "R-1-0001", text: "Wetland restoration projects eligible when activities convert degraded wetlands to forest." },
  ],
};

const arAms0007SectionsJson = {
  sections: [{ id: "S-1", title: "Eligibility", anchor: "#S-1" }],
};

const arAm0014RulesJson = {
  rules: [
    { id: "R-1-0001", text: "Afforestation activity must satisfy the methodology eligibility screen." },
  ],
};

const arAm0014SectionsJson = {
  sections: [{ id: "S-1", title: "Eligibility", anchor: "#S-1" }],
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

function withTemporaryMethodologyCheckout<T>(
  callback: () => T,
  options: {
    methodCode?: string;
    version?: string;
    rules?: unknown;
    sections?: unknown;
  } = {},
): T {
  const previousCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article6-audit-pack-"));
  const methodCode = options.methodCode ?? "AR-ACM0003";
  const version = options.version ?? "v02-0";
  const rules = options.rules ?? rulesJson;
  const sections = options.sections ?? sectionsJson;
  const methodDir = path.join(root, "public", "methodologies", "UNFCCC", "Forestry", methodCode, version);

  fs.mkdirSync(methodDir, { recursive: true });
  fs.writeFileSync(
    path.join(methodDir, "META.json"),
    JSON.stringify({ code: methodCode, version, title: "Temporary test methodology" }),
  );
  fs.writeFileSync(path.join(methodDir, "rules.json"), JSON.stringify(rules));
  fs.writeFileSync(path.join(methodDir, "sections.json"), JSON.stringify(sections));
  fs.writeFileSync(path.join(methodDir, "rules.rich.json"), JSON.stringify(rules));
  fs.writeFileSync(path.join(methodDir, "sections.rich.json"), JSON.stringify(sections));

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
      aoi: {
        id: "aoi_demo",
        bbox: [1, 2, 3, 4],
        geojson: {
          type: "Feature",
          properties: { name: "Demo AOI" },
          geometry: {
            type: "Polygon",
            coordinates: [[[1, 2], [3, 2], [3, 4], [1, 4], [1, 2]]],
          },
        },
      },
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
      support_facts: {
        lookup_status: "results_available",
        lookup_message: "1 linked AOI/STAC support fact recorded for this rule.",
        search_result_count: 2,
        available_unlinked_ids: ["sentinel-scene-2"],
        run_id: "run-final-1",
        linked_facts: [
          {
            id: "sentinel-scene-1",
            datetime: "2026-04-20T00:00:00Z",
            cloud_cover: 3,
            collection: "sentinel-2",
            source_catalog_ref: "https://stac.example.test",
            source_provider: "stac.example.test",
            linked_at: "2026-04-24T11:54:00.000Z",
            aoi_relation_summary: "Overlaps active AOI bbox",
            asset_href: "https://stac.example.test/assets/sentinel-scene-1.tif",
            link_href: "https://stac.example.test/items/sentinel-scene-1",
            source_pin_ids: ["pin-scene-1"],
            linked_rule_ids: ["R-1-0001"],
          },
        ],
        stale_facts: [
          {
            id: "sentinel-scene-old",
            datetime: "2026-04-10T00:00:00Z",
            collection: "sentinel-2",
            source_catalog_ref: "https://stac.example.test",
            source_provider: "stac.example.test",
            linked_at: "2026-04-11T11:54:00.000Z",
            aoi_relation_summary: "Previously linked STAC fact exists, but it is not from the active AOI search",
            asset_href: null,
            link_href: "https://stac.example.test/items/sentinel-scene-old",
            source_pin_ids: ["pin-scene-old"],
            linked_rule_ids: ["R-1-0001"],
          },
        ],
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
        stacSupportFactsStatus: "results_available",
        linkedStacSupportFactCount: 1,
        unlinkedStacSupportFactCount: 1,
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
        attachments: [
          {
            id: "att-pdd-1",
            pin_id: "pin-pdd-1",
            filename: "mai_ndombe_synthetic_pdd.pdf",
            mime: "application/pdf",
            size: 24,
            sha256: sha256Hex(Buffer.from("%PDF-1.4 synthetic PDD bytes", "utf8")),
            created_at: "2026-04-24T11:56:00.000Z",
          },
        ],
        pdd_fragments: [{ evidence_id: "pin-pdd-1", fragment_id: "frag-monitoring-period", label: "Monitoring period", page_start: 12 }],
        pdd_fragment_links: [{ fragment_id: "frag-monitoring-period", rule_id: "R-1-0001", linked_at: "2026-04-24T11:57:00.000Z" }],
        pdd_document: {
          evidence_id: "pin-pdd-1",
          attachment_id: "att-pdd-1",
          file_name: "mai_ndombe_synthetic_pdd.pdf",
          mime: "application/pdf",
          added_at: "2026-04-24T11:56:00.000Z",
          sha256: sha256Hex(Buffer.from("%PDF-1.4 synthetic PDD bytes", "utf8")),
        },
      },
    ];
    const pddBytes = Buffer.from("%PDF-1.4 synthetic PDD bytes", "utf8");

    const zip = withTemporaryMethodologyCheckout(() =>
      buildAuditPackZip("AR-ACM0003", "v02-0", {
        finalizedReview: {
          artifact,
          evidencePins,
          sourceFiles: [
            {
              evidence_ref: "pin-pdd-1",
              source_pin_id: "pin-pdd-1",
              attachment_id: "att-pdd-1",
              file_name: "mai_ndombe_synthetic_pdd.pdf",
              mime: "application/pdf",
              bytes_base64: pddBytes.toString("base64"),
              sha256: sha256Hex(pddBytes),
            },
          ],
        },
      }),
    );
    const entries = unzipSync(new Uint8Array(zip));
    const readJson = (entry: string) => JSON.parse(strFromU8(entries[entry]));

    const manifest = readJson("manifest.json") as { generated_at: string };
    expect(manifest.generated_at).toBe("2026-04-24T12:00:00.000Z");
    expect(manifest.generated_at).not.toBe("1970-01-01T00:00:00.000Z");

    const requirementReview = readJson("requirement-review.json") as {
      summary: { placeholder_rule_reviews: number; linked_evidence_refs: number };
      rules: Array<{
        linked_evidence_refs: string[];
        reconciliation?: { status: string | null };
        reviewer_artifact?: { outcome_note: string | null };
        stac_support_facts?: {
          lookup_status: string;
          available_unlinked_ids: string[];
          linked_facts: Array<{ id: string; source_provider: string | null; linked_rule_ids: string[] }>;
          stale_facts?: Array<{ id: string; linked_rule_ids: string[] }>;
        };
      }>;
    };
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(0);
    expect(requirementReview.summary.linked_evidence_refs).toBeGreaterThanOrEqual(2);
    expect(requirementReview.rules).toHaveLength(1);
    expect(requirementReview.rules[0].linked_evidence_refs).toEqual(expect.arrayContaining(["sentinel-scene-1", "frag-monitoring-period"]));
    expect(requirementReview.rules[0].reconciliation?.status).toBe("Supported");
    expect(requirementReview.rules[0].reviewer_artifact?.outcome_note).toBe("Ready for external review.");
    expect(requirementReview.rules[0].stac_support_facts).toEqual(
      expect.objectContaining({
        lookup_status: "results_available",
        available_unlinked_ids: ["sentinel-scene-2"],
        linked_facts: [
          expect.objectContaining({
            id: "sentinel-scene-1",
            source_provider: "stac.example.test",
            linked_rule_ids: ["R-1-0001"],
          }),
        ],
        stale_facts: [
          expect.objectContaining({
            id: "sentinel-scene-old",
            linked_rule_ids: ["R-1-0001"],
          }),
        ],
      }),
    );
    expect(JSON.stringify(requirementReview)).not.toContain("awaiting_project_evidence");

    const evidenceManifest = readJson("evidence-manifest.json") as {
      summary: { provided_refs: number; placeholder_refs: number };
      evidence: Array<{
        evidence_ref: string;
        status: string;
        placeholder: boolean;
        included_in_pack: boolean;
        file_path: string | null;
        sha256: string | null;
        parent_source_evidence_ref?: string | null;
        parent_source_file_path?: string | null;
      }>;
    };
    expect(evidenceManifest.summary.provided_refs).toBe(2);
    expect(evidenceManifest.summary.placeholder_refs).toBe(0);
    expect(evidenceManifest.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_ref: "sentinel-scene-1", status: "not_provided", placeholder: false }),
        expect.objectContaining({
          evidence_ref: "pin-pdd-1",
          status: "provided",
          placeholder: false,
          included_in_pack: true,
          file_path: "evidence/source/pin-pdd-1/mai_ndombe_synthetic_pdd.pdf",
          sha256: sha256Hex(pddBytes),
        }),
        expect.objectContaining({
          evidence_ref: "frag-monitoring-period",
          status: "not_provided",
          placeholder: false,
          included_in_pack: false,
          parent_source_evidence_ref: "pin-pdd-1",
          parent_source_file_path: "evidence/source/pin-pdd-1/mai_ndombe_synthetic_pdd.pdf",
        }),
        expect.objectContaining({
          evidence_ref: "aoi_demo",
          status: "provided",
          placeholder: false,
          included_in_pack: true,
          file_path: "evidence/source/aoi_demo/Demo_AOI.geojson",
        }),
      ]),
    );
    expect(JSON.stringify(evidenceManifest)).not.toContain("awaiting_project_evidence");
    expect(entries["evidence/source/pin-pdd-1/mai_ndombe_synthetic_pdd.pdf"]).toEqual(new Uint8Array(pddBytes));
    expect(entries["evidence/source/aoi_demo/Demo_AOI.geojson"]).toBeTruthy();
    const manifestFiles = (readJson("manifest.json") as { files: Array<{ path: string; sha256: string; bytes: number }> }).files;
    expect(manifestFiles).toEqual(
      expect.arrayContaining([
        {
          path: "evidence/source/pin-pdd-1/mai_ndombe_synthetic_pdd.pdf",
          sha256: sha256Hex(pddBytes),
          bytes: pddBytes.length,
        },
      ]),
    );
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

  test("integrates evidence intelligence into live audit-pack exports", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "R-1-0001",
        methodology: "AR-ACM0003",
        version: "v02-0",
        status: "verified",
        rationale: "Monitoring-period evidence is linked directly to the rule.",
        supportReference: "pin-pdd-1",
        evidenceLink: "frag-monitoring-period",
        evidenceAttachments: [],
        reviewedBy: "Verifier A",
        reviewedAt: "2026-04-24T12:00:00.000Z",
        updatedAt: "2026-04-24T12:00:00.000Z",
      },
    ];
    const evidencePins: EvidencePin[] = [
      {
        id: "pin-pdd-1",
        kind: "pdd",
        title: "Monitoring period PDD",
        ruleId: "R-1-0001",
        cited_ids: ["R-1-0001"],
        created_at: "2026-04-24T11:55:00.000Z",
        pdd_document: {
          evidence_id: "pin-pdd-1",
          file_name: "monitoring-period.pdf",
          mime: "application/pdf",
          added_at: "2026-04-24T11:55:00.000Z",
          sha256: "a".repeat(64),
        },
        pdd_fragments: [
          {
            fragment_id: "frag-monitoring-period",
            evidence_id: "pin-pdd-1",
            label: "Monitoring period",
            page_start: 12,
            page_end: 13,
            section_label: "Section 4",
            section_heading: "Monitoring period",
            excerpt: "The monitoring period covers 2023-01-01 through 2023-12-31.",
          },
        ],
        pdd_fragment_links: [
          {
            fragment_id: "frag-monitoring-period",
            rule_id: "R-1-0001",
            linked_at: "2026-04-24T11:56:00.000Z",
          },
        ],
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
              runId: "run-evidence-intel-1",
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
              runId: "run-evidence-intel-1",
            },
          },
        },
      }),
    );

    const entries = unzipSync(new Uint8Array(zip));
    expect(entries["evidence-intelligence.json"]).toBeDefined();
    expect(entries["evidence-fragments.json"]).toBeDefined();
    expect(entries["coverage-matrix.json"]).toBeDefined();
    expect(entries["reviewer-decisions.json"]).toBeDefined();

    const evidenceIntel = JSON.parse(strFromU8(entries["evidence-intelligence.json"])) as {
      summary: { fragmentCount: number; factCount: number };
      fragments: Array<{ fragmentId: string; pageStart?: number }>;
      decisions: { decisions: Array<{ evidenceLinks: Array<{ evidenceRef: string; reportAnchor: string }> }> };
    };
    expect(evidenceIntel.summary.fragmentCount).toBeGreaterThanOrEqual(1);
    expect(evidenceIntel.summary.factCount).toBeGreaterThanOrEqual(1);
    expect(evidenceIntel.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fragmentId: "frag-monitoring-period",
          pageStart: 12,
        }),
      ]),
    );
    expect(evidenceIntel.decisions.decisions[0]?.evidenceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceRef: "frag-monitoring-period",
          reportAnchor: "#evidence-ref-frag-monitoring-period",
        }),
      ]),
    );

    const html = strFromU8(entries["VERIFICATION_REPORT.html"]);
    expect(html).toContain("Evidence Fragments");
    expect(html).toContain("Coverage Matrix");
    expect(html).toContain("Reviewer Decisions");
    expect(html).toContain('href="#evidence-ref-frag-monitoring-period"');
    expect(html).toContain('id="fragment-frag-monitoring-period"');

    const secondZip = withTemporaryMethodologyCheckout(() =>
      buildAuditPackZip("AR-ACM0003", "v02-0", {
        currentReview: {
          latestReviewAt: "2026-04-24T12:05:00.000Z",
          reviews,
          evidencePins,
          verifierBundle: {
            runContext: {
              runId: "run-evidence-intel-1",
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
              runId: "run-evidence-intel-1",
            },
          },
        },
      }),
    );
    expect(Buffer.from(zip).equals(Buffer.from(secondZip))).toBe(true);
  });

  test("upgrades VERIFICATION_REPORT.html into a truthful readiness review skeleton when project context and files are missing", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "R-1-0001",
        methodology: "AR-ACM0003",
        version: "v02-0",
        status: "needs_followup",
        rationale: "AOI/PDD boundary reconciliation still required before readiness conclusion.",
        supportReference: "boundary-note-1",
        evidenceLink: "pdd-boundary-fragment",
        evidenceAttachments: [],
        reviewedBy: "Verifier A",
        reviewedAt: "2026-04-24T12:00:00.000Z",
        updatedAt: "2026-04-24T12:00:00.000Z",
      },
    ];

    const zip = withTemporaryMethodologyCheckout(
      () =>
        buildAuditPackZip("AR-ACM0003", "v02-0", {
          currentReview: {
            latestReviewAt: "2026-04-24T12:05:00.000Z",
            reviews,
            evidencePins: [],
            verifierBundle: {
              runContext: {
                runId: "AR-ACM0003-v02-0-20260504172354391",
                createdAt: "2026-04-24T11:45:00.000Z",
              },
              savedReviewerArtifactAt: "2026-04-24T12:05:00.000Z",
              finalizedAt: null,
              minutes: "Boundary notes captured locally.",
              outcomeNote: "Needs follow-up before readiness conclusion.",
              savedReviewerArtifactContext: {
                methodCode: "AR-ACM0003",
                version: "v02-0",
                ruleId: "R-1-0001",
                runId: "AR-ACM0003-v02-0-20260504172354391",
              },
            },
          },
        }),
      {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        rules: readinessSkeletonRulesJson,
        sections: readinessSkeletonSectionsJson,
      },
    );

    const entries = unzipSync(new Uint8Array(zip));
    const html = strFromU8(entries["VERIFICATION_REPORT.html"]);

    expect(html).toContain("Verification Readiness Review");
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Project Context");
    expect(html).toContain("Evidence Register");
    expect(html).toContain("Requirement Review");
    expect(html).toContain("Findings");
    expect(html).toContain("Follow-up Actions");
    expect(html).toContain("Limitations");
    expect(html).toContain("Integrity Appendix");

    expect(html).toContain("Draft / incomplete local method review export");
    expect(html).toContain("This report is not a formal verification opinion.");
    expect(html).toContain("This report is not a formal validation opinion.");
    expect(html).toContain("local/browser-state review data");

    expect(html).toContain("<dt>Project name</dt><dd>Unlinked method review</dd>");
    expect(html).toContain("<dt>Project ID</dt><dd>Not provided</dd>");
    expect(html).toContain("<dt>Country / location</dt><dd>Not provided</dd>");
    expect(html).toContain("<dt>Proponent</dt><dd>Not provided</dd>");
    expect(html).not.toContain("<dt>Project ID</dt><dd>AR-ACM0003-v02-0-20260504172354391</dd>");
    expect(html).toContain("<dt>Pack / export ID</dt><dd>AR-ACM0003-v02-0-20260504172354391</dd>");

    expect(html).toContain("boundary-note-1");
    expect(html).toContain("pdd-boundary-fragment");
    expect(html).toContain("Referenced only — file not included");
    expect(html).toContain(">Unavailable<");

    expect(html).toContain("Needs Follow-up");
    expect(html).toContain("R-1-0002");
    expect(html).toContain("R-1-0008");
    expect(html).toContain("AOI/PDD boundary reconciliation still required before readiness conclusion.");
    expect(html).toContain("F-001");
    expect(html).toContain("AR-ACM0003-v02-0-20260504172354391");
    expect(html).toContain("manifest.json");

    expect(html.indexOf("R-1-0001")).toBeLessThan(html.indexOf("R-1-0002"));
    expect(html).toContain("<strong>Total rules</strong><div>8</div>");
    expect(html).toContain("<strong>Reviewed</strong><div>1</div>");
    expect(html).toContain("<strong>Unreviewed</strong><div>7</div>");
    expect(html).toContain("<strong>Needs follow-up</strong><div>1</div>");
  });

  test("exports a saved current review when the saved ruleId is the canonical rich-rule id", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002",
        methodology: "AR-ACM0003",
        version: "v02-0",
        status: "verified",
        rationale: "Baseline calculation worksheet is present and internally consistent.",
        supportReference: "calc-sheet-2",
        evidenceLink: "calc-sheet-2",
        evidenceAttachments: [],
        reviewedBy: "local-reviewer",
        reviewedAt: "2026-04-24T13:00:00.000Z",
        updatedAt: "2026-04-24T13:00:00.000Z",
      },
    ];

    const zip = withTemporaryMethodologyCheckout(() =>
      buildAuditPackZip("AR-ACM0003", "v02-0", {
        currentReview: {
          latestReviewAt: "2026-04-24T13:05:00.000Z",
          reviews,
          evidencePins: [],
          verifierBundle: {
            runContext: {
              runId: "run-draft-2",
              createdAt: "2026-04-24T12:45:00.000Z",
            },
            savedReviewerArtifactAt: "2026-04-24T13:05:00.000Z",
            finalizedAt: null,
            minutes: "Reviewer minutes for baseline calculations",
            outcomeNote: "Needs evidence linkage before finalization.",
            savedReviewerArtifactContext: {
              methodCode: "AR-ACM0003",
              version: "v02-0",
              ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002",
              runId: "run-draft-2",
            },
          },
        },
      }),
    );
    const entries = unzipSync(new Uint8Array(zip));
    const requirementReview = JSON.parse(strFromU8(entries["requirement-review.json"])) as {
      rules: Array<{
        rule_id: string;
        status: string;
        rationale: string;
        reviewer_artifact?: { outcome_note: string | null; minutes_present: boolean };
      }>;
    };
    const exportedRule = requirementReview.rules.find((rule) => rule.rule_id === "R-1-0002");

    expect(exportedRule).toEqual(
      expect.objectContaining({
        rule_id: "R-1-0002",
        status: "reviewed_verified",
        rationale: "Baseline calculation worksheet is present and internally consistent.",
        reviewer_artifact: expect.objectContaining({
          outcome_note: "Needs evidence linkage before finalization.",
          minutes_present: true,
        }),
      }),
    );
  });

  test("uses linked project and workspace context in the HTML report when provided", () => {
    const zip = withTemporaryMethodologyCheckout(
      () =>
        buildAuditPackZip("AR-ACM0003", "v02-0", {
          currentReview: {
            latestReviewAt: "2026-05-21T09:05:00.000Z",
            reviews: [],
            evidencePins: [],
            verifierBundle: {
              runContext: {
                runId: "run-linked-project-1",
                createdAt: "2026-05-21T09:00:00.000Z",
              },
            },
            projectContext: {
              projectId: "proj_liwonde",
              projectCode: "VCS-1530",
              projectName: "Liwonde National Park REDD+",
              countryLocation: "Malawi",
              proponent: "Article6 Climate",
              reportingPeriod: "2024-01-01 to 2024-12-31",
              workspaceId: "ws_liwonde_review",
              workspaceName: "Liwonde REDD+ · AR-ACM0003 v02-0 review",
            },
          },
        }),
      {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        rules: readinessSkeletonRulesJson,
        sections: readinessSkeletonSectionsJson,
      },
    );

    const entries = unzipSync(new Uint8Array(zip));
    const html = strFromU8(entries["VERIFICATION_REPORT.html"]);

    expect(html).toContain("<dt>Project name</dt><dd>Liwonde National Park REDD+</dd>");
    expect(html).toContain("<dt>Project ID</dt><dd>VCS-1530</dd>");
    expect(html).toContain("<dt>Country / location</dt><dd>Malawi</dd>");
    expect(html).toContain("<dt>Proponent</dt><dd>Article6 Climate</dd>");
    expect(html).toContain("Liwonde REDD+ · AR-ACM0003 v02-0 review");
    expect(html).not.toContain("<dt>Project name</dt><dd>Not provided</dd>");
  });

  test("does not attach reviewer artifact text from another method into AR-AMS0007 current-review exports", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "R-1-0001",
        methodology: "AR-AMS0007",
        version: "v03-1",
        status: "verified",
        rationale: "Wetland eligibility conditions were reviewed in the current workspace.",
        supportReference: "",
        evidenceAttachments: [],
        reviewedBy: "local-reviewer",
        reviewedAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T09:00:00.000Z",
      },
    ];

    const zip = withTemporaryMethodologyCheckout(
      () =>
        buildAuditPackZip("AR-AMS0007", "v03-1", {
          currentReview: {
            latestReviewAt: "2026-04-25T09:05:00.000Z",
            reviews,
            evidencePins: [],
            verifierBundle: {
              runContext: {
                runId: "run-ams-draft-1",
                createdAt: "2026-04-25T08:45:00.000Z",
              },
              savedReviewerArtifactAt: "2026-04-25T09:05:00.000Z",
              finalizedAt: null,
              minutes: "Fixture minutes from AR-ACM0003 v02-0.",
              outcomeNote: "Fixture outcome note for UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001.",
              savedReviewerArtifactContext: {
                methodCode: "AR-ACM0003",
                version: "v02-0",
                ruleId: "R-1-0001",
                runId: "run-acm-draft-1",
              },
            },
          },
        }),
      {
        methodCode: "AR-AMS0007",
        version: "v03-1",
        rules: arAms0007RulesJson,
        sections: arAms0007SectionsJson,
      },
    );
    const entries = unzipSync(new Uint8Array(zip));
    const requirementReview = JSON.parse(strFromU8(entries["requirement-review.json"])) as {
      method: { code: string; version: string };
      rules: Array<{
        rule_id: string;
        status: string;
        rationale: string;
        reviewer_artifact?: { outcome_note: string | null; minutes_present: boolean };
      }>;
    };
    const exportedRule = requirementReview.rules.find((rule) => rule.rule_id === "R-1-0001");

    expect(requirementReview.method).toEqual({ code: "AR-AMS0007", version: "v03-1" });
    expect(exportedRule).toEqual(
      expect.objectContaining({
        rule_id: "R-1-0001",
        status: "reviewed_verified",
        rationale: "Wetland eligibility conditions were reviewed in the current workspace.",
      }),
    );
    expect(exportedRule?.reviewer_artifact).toBeUndefined();
    expect(JSON.stringify(exportedRule)).not.toContain("AR-ACM0003");
  });

  test("exports a linked current-review evidence pin when the pin uses a fully-qualified rule id", () => {
    const reviews: RuleReview[] = [
      {
        ruleId: "R-1-0001",
        methodology: "AR-AM0014",
        version: "v03-0",
        status: "verified",
        rationale: "Eligibility was reviewed against the linked scene evidence.",
        supportReference: "am14-scene-1",
        evidenceLink: "am14-scene-1",
        evidenceAttachments: [],
        reviewedBy: "local-reviewer",
        reviewedAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    ];
    const evidencePins: EvidencePin[] = [
      {
        id: "pin-am14-scene-1",
        kind: "note",
        title: "am14-scene-1",
        ruleId: "UNFCCC.Forestry.AR-AM0014.v03-0.R-1-0001",
        itemId: "am14-scene-1",
        cited_ids: ["UNFCCC.Forestry.AR-AM0014.v03-0.R-1-0001"],
        created_at: "2026-04-25T09:55:00.000Z",
      },
      {
        id: "pin-am14-unlinked-1",
        kind: "note",
        title: "am14-unlinked-1",
        itemId: "am14-unlinked-1",
        cited_ids: [],
        created_at: "2026-04-25T09:56:00.000Z",
      },
    ];

    const zip = withTemporaryMethodologyCheckout(
      () =>
        buildAuditPackZip("AR-AM0014", "v03-0", {
          currentReview: {
            latestReviewAt: "2026-04-25T10:05:00.000Z",
            reviews,
            evidencePins,
            verifierBundle: {
              runContext: {
                runId: "run-am14-draft-1",
                createdAt: "2026-04-25T09:45:00.000Z",
              },
              savedReviewerArtifactAt: null,
              finalizedAt: null,
              minutes: "",
              outcomeNote: "",
            },
          },
        }),
      {
        methodCode: "AR-AM0014",
        version: "v03-0",
        rules: arAm0014RulesJson,
        sections: arAm0014SectionsJson,
      },
    );
    const entries = unzipSync(new Uint8Array(zip));
    const evidenceManifest = JSON.parse(strFromU8(entries["evidence-manifest.json"])) as {
      summary: { total_refs: number; provided_refs: number };
      evidence: Array<{ evidence_ref: string; rule_ids: string[] }>;
    };
    const requirementReview = JSON.parse(strFromU8(entries["requirement-review.json"])) as {
      rules: Array<{ rule_id: string; linked_evidence_refs: string[] }>;
    };
    const traceJson = JSON.parse(strFromU8(entries["trace.json"])) as {
      rule_to_evidence: Record<string, string[]>;
    };
    const exportedRule = requirementReview.rules.find((rule) => rule.rule_id === "R-1-0001");

    expect(evidenceManifest.summary.total_refs).toBeGreaterThanOrEqual(1);
    expect(evidenceManifest.summary.provided_refs).toBe(0);
    expect(evidenceManifest.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_ref: "am14-scene-1",
        }),
      ]),
    );
    expect(evidenceManifest.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_ref: "am14-unlinked-1",
        }),
      ]),
    );
    expect(exportedRule?.linked_evidence_refs).toEqual(expect.arrayContaining(["am14-scene-1"]));
    expect(exportedRule?.linked_evidence_refs).not.toContain("am14-unlinked-1");
    expect(traceJson.rule_to_evidence["R-1-0001"]).toEqual(expect.arrayContaining(["am14-scene-1"]));
    expect(traceJson.rule_to_evidence["R-1-0001"]).not.toContain("am14-unlinked-1");
  });
});
