import { describe, expect, test } from "@jest/globals";
import { buildVerificationPackContractFiles } from "@/exports/verificationPackContract";

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
});
