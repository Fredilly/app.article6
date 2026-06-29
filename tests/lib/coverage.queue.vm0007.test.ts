import { describe, expect, it } from "@jest/globals";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { getRuleDisplayMetadata } from "@/lib/coverage/ruleDisplay";

describe("VM0007 coverage queue integrity", () => {
  /**
   * Loads VM0007 v1-8 rules directly from the committed methodology pack
   * fixture (rules.rich.json), so this test does not depend on generated files.
   */
  function loadRichRules(): Record<string, unknown>[] {
    const fs = require("node:fs");
    const path = require("node:path");
    const rulesPath = path.resolve("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
    return JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  }

  /**
   * Converts a raw rich-format rule into the display metadata shape,
   * simulating what the runtime code does when building coverage rules.
   */
  function richRuleToCoverageItem(r: Record<string, unknown>) {
    const ctx = r.section_context as Record<string, unknown> | undefined;
    return {
      id: (r.stable_id ?? r.id) as string,
      // In rich format: no title key, human label is in "summary"
      title: (r.title as string) ?? "",
      summary: (r.summary as string) ?? null,
      sectionId: ((ctx?.section_id ?? "") as string) || ((r.refs as Record<string, unknown> | undefined)?.primary_section as string) || "",
      sectionTitle: (ctx?.section_title as string) ?? "",
      tags: [],
    };
  }

  it("every VM0007 coverage item has rule ID, human-readable title, and section ID", () => {
    const rawRules = loadRichRules();
    const coverageItems = rawRules.map(richRuleToCoverageItem);

    // Every item must have a valid non-empty stable ID
    for (const item of coverageItems) {
      expect(item.id).toBeTruthy();
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
    }

    // Every item must have a human-readable title that is NOT just the rule ID
    const idPattern = /^Verra\.AFOLU\.VM0007\.v1-8\./;
    for (const item of coverageItems) {
      const meta = getRuleDisplayMetadata(item);
      expect(meta.humanTitle).toBeTruthy();
      expect(typeof meta.humanTitle).toBe("string");
      expect(meta.humanTitle.length).toBeGreaterThan(0);
      // Human title must not be the stable ID
      expect(meta.humanTitle).not.toBe(meta.stableId);
      // Human title must not look like a machine ID
      expect(idPattern.test(meta.humanTitle)).toBe(false);
    }

    // Every item must have a sectionId
    for (const item of coverageItems) {
      expect(item.sectionId).toBeTruthy();
      expect(typeof item.sectionId).toBe("string");
      expect(item.sectionId.length).toBeGreaterThan(0);
    }

    // Every item should have a defined sectionTitle (may be empty for some)
    for (const item of coverageItems) {
      expect(item.sectionTitle).toBeDefined();
      expect(typeof item.sectionTitle).toBe("string");
    }

    // Verify count is correct
    expect(coverageItems.length).toBe(58);
  });

  it("VM0007 coverage queue shows human title, stable ID only once, and section title", () => {
    const rawRules = loadRichRules();
    const queueRules = rawRules.map(richRuleToCoverageItem);

    const summary = buildCoverageQueue({ rules: queueRules, coveredRuleIds: new Set(), limit: 58 });

    // All 58 should be uncovered
    expect(summary.total).toBe(58);
    expect(summary.uncovered).toBe(58);

    for (const item of summary.topUncovered) {
      const meta = getRuleDisplayMetadata(item);

      // Human title must be the primary display text — not the stable ID
      expect(meta.humanTitle).toBeTruthy();
      expect(meta.humanTitle).not.toBe(meta.stableId);

      // Stable ID should appear only once per item (no duplication)
      // Count: stableId appears once in the metadata, not in humanTitle
      const stableIdCount = (meta.humanTitle + " " + meta.sectionTitle + " " + meta.stableId)
        .split(meta.stableId).length - 1;
      expect(stableIdCount).toBe(1);
    }

    // Section titles should exist for most rules
    const titlesWithSection = summary.topUncovered.filter((r: { sectionTitle?: string }) => r.sectionTitle).length;
    expect(titlesWithSection).toBeGreaterThan(50);
  });

  it("VM0007 drawer title matches opened rule view title", () => {
    const rawRules = loadRichRules();
    const coverageItems = rawRules.map(richRuleToCoverageItem);

    for (const item of coverageItems) {
      const meta = getRuleDisplayMetadata(item);

      // The opened rule view uses ruleSummary.title which comes from
      // buildRequirementCoverageRows → rule.title (falls back from summary).
      // Verify our helper returns the same title.
      const summary = (item.summary as string) || (item.title as string) || "";
      expect(meta.humanTitle).toBe(summary || "Unknown rule title");
    }
  });
});
