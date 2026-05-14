import { describe, expect, it } from "@jest/globals";
import { computeReadiness, deriveArtifactUrls, emptyReadiness } from "@/lib/methodReadiness";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

function fullMeta(): unknown {
  return {
    artifact_status: {
      rules: "source_audited",
      sections: "source_audited",
      source_pdf: "verified",
    },
    methodology_linked_review_ready: true,
    methodology_linked_review_blockers: [],
    artifact_quality_standard: { adoption_status: "grade_a" },
  };
}

function makeMethod(overrides?: Partial<MethodInventoryItem>): MethodInventoryItem {
  const latest = overrides?.latestVersion ?? "v1-0";
  return {
    code: overrides?.code ?? "METH",
    program: overrides?.program ?? "Verra",
    sector: overrides?.sector ?? "Energy",
    versions: overrides?.versions ?? ["v1-0"],
    latestVersion: latest,
    versionCount: overrides?.versionCount ?? 1,
    ruleCountByVersion: overrides?.ruleCountByVersion ?? { "v1-0": 10 },
    hasRich: overrides?.hasRich ?? false,
    hasPrevious: overrides?.hasPrevious ?? false,
    versionAuditHashes: overrides?.versionAuditHashes ?? {},
  };
}

describe("computeReadiness", () => {
  it("returns full readiness when all conditions are met", () => {
    const r = computeReadiness(fullMeta(), 10);
    expect(r.hasRules).toBe(true);
    expect(r.hasSections).toBe(true);
    expect(r.hasMeta).toBe(true);
    expect(r.sourceAudited).toBe(true);
    expect(r.ruleCount).toBe(10);
    expect(r.activeBlockers).toEqual([]);
    expect(r.missingArtifacts).toEqual([]);
  });

  it("returns sourceAudited=false when meta is null", () => {
    const r = computeReadiness(null, 0);
    expect(r.sourceAudited).toBe(false);
    expect(r.hasMeta).toBe(true);
  });

  it("reports missing artifacts when artifact_status fields are absent", () => {
    const meta = { artifact_status: {}, methodology_linked_review_blockers: [] };
    const r = computeReadiness(meta, 5);
    expect(r.hasRules).toBe(false);
    expect(r.hasSections).toBe(false);
    expect(r.sourceAudited).toBe(false);
    expect(r.missingArtifacts).toContain("rules.json");
    expect(r.missingArtifacts).toContain("sections.json");
  });

  it("reports active blockers from meta", () => {
    const meta = {
      artifact_status: { rules: "draft", sections: "draft" },
      methodology_linked_review_blockers: ["Missing VVB sign-off", "Awaiting PDF"],
    };
    const r = computeReadiness(meta, 0);
    expect(r.activeBlockers).toEqual(["Missing VVB sign-off", "Awaiting PDF"]);
    expect(r.sourceAudited).toBe(false);
  });

  it("returns sourceAudited=false when adoption_status is unsupported", () => {
    const meta = {
      ...(fullMeta() as Record<string, unknown>),
      artifact_quality_standard: { adoption_status: "unknown" },
    };
    const r = computeReadiness(meta, 10);
    expect(r.sourceAudited).toBe(false);
  });

  it("isolates ruleCount from the method data", () => {
    const r = computeReadiness(fullMeta(), 42);
    expect(r.ruleCount).toBe(42);
  });
});

describe("emptyReadiness", () => {
  it("returns all-false state with META.json missing", () => {
    const r = emptyReadiness();
    expect(r.hasRules).toBe(false);
    expect(r.hasSections).toBe(false);
    expect(r.hasMeta).toBe(false);
    expect(r.sourceAudited).toBe(false);
    expect(r.ruleCount).toBe(0);
    expect(r.missingArtifacts).toEqual(["META.json"]);
  });
});

describe("deriveArtifactUrls", () => {
  it("returns root-relative URLs for a normal method", () => {
    const method = makeMethod({
      code: "VM0047",
      program: "Verra",
      sector: "AFOLU",
      latestVersion: "v1-0",
    });
    const urls = deriveArtifactUrls(method);
    expect(urls.metaUrl).toBe("/methodologies/Verra/AFOLU/VM0047/v1-0/META.json");
    expect(urls.rulesUrl).toBe("/methodologies/Verra/AFOLU/VM0047/v1-0/rules.json");
    expect(urls.sectionsUrl).toBe("/methodologies/Verra/AFOLU/VM0047/v1-0/sections.json");
  });

  it("starts with a leading slash (root-relative)", () => {
    const method = makeMethod();
    const urls = deriveArtifactUrls(method);
    expect(urls.metaUrl).toMatch(/^\//);
    expect(urls.rulesUrl).toMatch(/^\//);
    expect(urls.sectionsUrl).toMatch(/^\//);
  });

  it("returns all-http URLs for a method with multiple versions", () => {
    const method = makeMethod({
      code: "VM0007",
      program: "Verra",
      sector: "AFOLU",
      latestVersion: "v1-1",
    });
    const urls = deriveArtifactUrls(method);
    expect(urls.rulesUrl).toBe("/methodologies/Verra/AFOLU/VM0007/v1-1/rules.json");
  });

  it("handles UNFCCC methods", () => {
    const method = makeMethod({
      code: "AR-ACM0003",
      program: "UNFCCC",
      sector: "Forestry",
      latestVersion: "v02-0",
    });
    const urls = deriveArtifactUrls(method);
    expect(urls.metaUrl).toBe("/methodologies/UNFCCC/Forestry/AR-ACM0003/v02-0/META.json");
  });
});
