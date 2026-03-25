import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";

function findRichFixture(): { methodology: string; version: string } {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Array<Record<string, unknown>>;

  for (const entry of manifest) {
    if (typeof entry.methodology !== "string" || typeof entry.version !== "string" || typeof entry.path !== "string") {
      continue;
    }

    const basePath = path.join(process.cwd(), "public", entry.path.replace(/^public\//, ""));
    const rulesRichPath = basePath.replace(/rules\.json$/, "rules.rich.json");
    const sectionsRichPath = basePath.replace(/rules\.json$/, "sections.rich.json");
    const sectionsPath = basePath.replace(/rules\.json$/, "sections.json");

    if (existsSync(rulesRichPath) && existsSync(sectionsRichPath) && existsSync(sectionsPath)) {
      return { methodology: entry.methodology, version: entry.version };
    }
  }

  throw new Error("No methodology fixture with rich rules and sections files was found in public/manifest/index.json");
}

describe("methodology pack consumption", () => {
  const fixture = findRichFixture();

  it("keeps rich rule logic and section refs when rules.rich.json is available", async () => {
    const result = await loadMethodRules(fixture.methodology, fixture.version);

    expect(result.source).toBe("rules.rich.json");
    expect(result.rules.length).toBeGreaterThan(0);

    const full = result.byId.get(result.rules[0]?.id ?? "");
    expect(full).toBeTruthy();
    expect(full?.text.trim().length).toBeGreaterThan(0);
    expect(full?.logic?.trim().length ?? 0).toBeGreaterThan(0);
    expect(full?.sectionId?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("merges rich section titles with plain section text when both files exist", async () => {
    const result = await loadMethodSections(fixture.methodology, fixture.version);

    expect(result.source).toBe("sections.rich.json");
    expect(result.sections.length).toBeGreaterThan(0);

    const withText = Array.from(result.byId.values()).find((section) => typeof section.text === "string" && section.text.trim());
    expect(withText).toBeTruthy();
    expect(withText?.title.trim().length ?? 0).toBeGreaterThan(0);
    expect(withText?.text?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
