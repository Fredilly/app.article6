import { describe, expect, it } from "@jest/globals";
import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";

describe("methodology pack consumption", () => {
  it("keeps rich rule logic and section refs when rules.rich.json is available", async () => {
    const result = await loadMethodRules("AMS-III.D", "v21-0");

    expect(result.source).toBe("rules.rich.json");
    expect(result.rules.length).toBeGreaterThan(0);

    const full = result.byId.get(result.rules[0]?.id ?? "");
    expect(full).toBeTruthy();
    expect(full?.text.trim().length).toBeGreaterThan(0);
    expect(full?.logic?.trim().length ?? 0).toBeGreaterThan(0);
    expect(full?.sectionId?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("merges rich section titles with plain section text when both files exist", async () => {
    const result = await loadMethodSections("AMS-III.D", "v21-0");

    expect(result.source).toBe("sections.rich.json");
    expect(result.sections.length).toBeGreaterThan(0);

    const withText = Array.from(result.byId.values()).find((section) => typeof section.text === "string" && section.text.trim());
    expect(withText).toBeTruthy();
    expect(withText?.title.trim().length ?? 0).toBeGreaterThan(0);
    expect(withText?.text?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
