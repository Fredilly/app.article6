import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import { buildAuditPackZip } from "@/exports/auditPack";

describe("audit pack verification contract", () => {
  test("includes demo-safe verification contract files for AR-ACM0003 v02-0", async () => {
    const zipBytes = buildAuditPackZip("AR-ACM0003", "v02-0");
    const zip = await JSZip.loadAsync(zipBytes);

    const requiredFiles = [
      "project.json",
      "evidence-manifest.json",
      "requirement-review.json",
      "trace.json",
      "trail.jsonl",
      "VERIFICATION_REPORT.html",
    ];

    for (const path of requiredFiles) {
      expect(zip.file(path)).toBeTruthy();
    }

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text")) as {
      files: Array<{ path: string }>;
    };
    const manifestPaths = new Set(manifest.files.map((file) => file.path));
    for (const path of requiredFiles) {
      expect(manifestPaths.has(path)).toBe(true);
    }

    const project = JSON.parse(await zip.file("project.json")!.async("text")) as {
      pack_profile: { name: string; not_a_formal_opinion: boolean };
      project_context: { placeholder: boolean; placeholder_reason: string };
      reviewer_assignment: { placeholder: boolean };
    };
    expect(project.pack_profile.name).toBe("demo_verification_contract");
    expect(project.pack_profile.not_a_formal_opinion).toBe(true);
    expect(project.project_context.placeholder).toBe(true);
    expect(project.project_context.placeholder_reason).toMatch(/project-specific evidence/i);
    expect(project.reviewer_assignment.placeholder).toBe(true);

    const evidenceManifest = JSON.parse(await zip.file("evidence-manifest.json")!.async("text")) as {
      summary: { total_refs: number; provided_refs: number; placeholder_refs: number };
      evidence: Array<{ sha256: string | null; included_in_pack: boolean; placeholder: boolean }>;
    };
    expect(evidenceManifest.summary.total_refs).toBeGreaterThan(0);
    expect(evidenceManifest.summary.provided_refs).toBe(0);
    expect(evidenceManifest.summary.placeholder_refs).toBe(evidenceManifest.summary.total_refs);
    expect(evidenceManifest.evidence.every((entry) => entry.included_in_pack === false)).toBe(true);
    expect(evidenceManifest.evidence.every((entry) => entry.sha256 === null)).toBe(true);
    expect(evidenceManifest.evidence.every((entry) => entry.placeholder === true)).toBe(true);

    const requirementReview = JSON.parse(await zip.file("requirement-review.json")!.async("text")) as {
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
    expect(requirementReview.summary.total_rules).toBe(8);
    expect(requirementReview.summary.placeholder_rule_reviews).toBe(8);
    expect(requirementReview.summary.linked_evidence_refs).toBe(0);
    expect(requirementReview.rules.every((rule) => rule.status === "awaiting_project_evidence")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.status_basis === "demo_placeholder")).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.linked_evidence_refs.length === 0)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.requested_evidence_refs.length === 1)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.reviewer.placeholder === true)).toBe(true);
    expect(requirementReview.rules.every((rule) => rule.timestamps.reviewed_at === null)).toBe(true);

    const trace = JSON.parse(await zip.file("trace.json")!.async("text")) as {
      verification_contract: { mode: string; report_path: string; placeholder: boolean };
      rule_to_review: Record<string, { status: string; requested_evidence_refs: string[] }>;
      rule_to_evidence: Record<string, string[]>;
    };
    expect(trace.verification_contract.mode).toBe("demo_placeholder_review_contract");
    expect(trace.verification_contract.report_path).toBe("VERIFICATION_REPORT.html");
    expect(trace.verification_contract.placeholder).toBe(true);
    expect(trace.rule_to_review["R-1-0001"]?.status).toBe("awaiting_project_evidence");
    expect(trace.rule_to_review["R-1-0001"]?.requested_evidence_refs).toHaveLength(1);
    expect(trace.rule_to_evidence["R-1-0001"]).toEqual([]);

    const reportHtml = await zip.file("VERIFICATION_REPORT.html")!.async("text");
    expect(reportHtml).toContain("Demo review record only.");
    expect(reportHtml).toContain("not a formal verifier opinion");
    expect(reportHtml).toContain("R-1-0001");
  });
});
