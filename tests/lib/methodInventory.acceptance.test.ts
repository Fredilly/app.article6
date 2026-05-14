import { describe, expect, it } from "@jest/globals";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";
import { deriveStandard } from "@/lib/methodBadge";
import fs from "node:fs";
import path from "node:path";

describe("getMethodInventory cross-standard discovery", () => {
  it("includes Verra methods", async () => {
    const { methods } = await getMethodInventory();
    const verraMethods = methods.filter((m) => deriveStandard(m.program) === "Verra");
    expect(verraMethods.length).toBeGreaterThanOrEqual(2);
    const codes = verraMethods.map((m) => m.code);
    expect(codes).toContain("VM0007");
    expect(codes).toContain("VM0047");
  });

  it("includes UNFCCC methods alongside Verra", async () => {
    const { methods } = await getMethodInventory();
    const unfcccMethods = methods.filter((m) => deriveStandard(m.program) === "UNFCCC");
    expect(unfcccMethods.length).toBeGreaterThanOrEqual(1);
    const verraMethods = methods.filter((m) => deriveStandard(m.program) === "Verra");
    expect(verraMethods.length).toBeGreaterThanOrEqual(2);
  });

  it("does not include GS-00XX", async () => {
    const { methods } = await getMethodInventory();
    const codes = methods.map((m) => m.code);
    expect(codes).not.toContain("GS-00XX");
  });
});

describe("Verra runtime artifact files exist", () => {
  const PUBLIC = path.resolve(process.cwd(), "public");

  function artifactsExist(code: string, provider: string, sector: string, version: string) {
    const dir = path.join(PUBLIC, "methodologies", provider, sector, code, version);
    return {
      meta: fs.existsSync(path.join(dir, "META.json")),
      rules: fs.existsSync(path.join(dir, "rules.json")),
      sections: fs.existsSync(path.join(dir, "sections.json")),
    };
  }

  it("VM0047 v1-0 has all three runtime artifacts", async () => {
    const { meta, rules, sections } = artifactsExist("VM0047", "Verra", "AFOLU", "v1-0");
    expect(meta).toBe(true);
    expect(rules).toBe(true);
    expect(sections).toBe(true);
  });

  it("VM0007 v1-8 has all three runtime artifacts", async () => {
    const { meta, rules, sections } = artifactsExist("VM0007", "Verra", "AFOLU", "v1-8");
    expect(meta).toBe(true);
    expect(rules).toBe(true);
    expect(sections).toBe(true);
  });

  it("META.json for each Verra method contains source-audited fields", () => {
    for (const { code, version } of [{ code: "VM0047", version: "v1-0" }, { code: "VM0007", version: "v1-8" }]) {
      const metaPath = path.join(PUBLIC, "methodologies", "Verra", "AFOLU", code, version, "META.json");
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      expect(meta.artifact_status?.rules).toBe("source_audited");
      expect(meta.artifact_status?.sections).toBe("source_audited");
      expect(meta.artifact_status?.source_pdf).toBe("verified");
      expect(meta.methodology_linked_review_ready).toBe(true);
      expect(meta.methodology_linked_review_blockers).toEqual([]);
      expect(["source_audited", "s_grade", "grade_a"]).toContain(meta.artifact_quality_standard?.adoption_status);
    }
  });
});
