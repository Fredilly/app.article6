import { describe, expect, it } from "@jest/globals";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { loadAndParseExtractedText } from "@/lib/quickCheckV2/evidence";

const ENVIRA_TXT = "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";

describe("VM0007 coverage queue integrity", () => {
  it("every VM0007 coverage item has rule ID, human-readable title, and section ID", () => {
    // Load VM0007 v1-8 rules from the methodology pack
    const fs = require("node:fs");
    const path = require("node:path");
    const rulesPath = path.resolve("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
    const rawRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

    // Build coverage-style items
    const coverageItems = rawRules.map((r: Record<string, unknown>) => {
      const ctx = r.section_context as Record<string, unknown> | undefined;
      const sid = ((ctx?.section_id as string) ?? (r.refs as Record<string, unknown> | undefined)?.primary_section ?? "") as string;
      return {
        id: r.stable_id as string,
        title: (r.summary as string) || (r.title as string) || "",
        sectionId: sid,
        sectionTitle: (ctx?.section_title as string) ?? "",
      };
    });

    // Every item must have a non-empty id
    for (const item of coverageItems) {
      expect(item.id).toBeTruthy();
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
    }

    // Every item must have a human-readable title that is NOT just the rule ID
    const idPattern = /^Verra\.AFOLU\.VM0007\.v1-8\./;
    for (const item of coverageItems) {
      expect(item.title).toBeTruthy();
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      // Title must not be just the rule ID
      expect(item.title).not.toBe(item.id);
      // Title must not be a suffix of the rule ID
      expect(idPattern.test(item.title)).toBe(false);
    }

    // Every item must have a sectionId
    for (const item of coverageItems) {
      expect(item.sectionId).toBeTruthy();
      expect(typeof item.sectionId).toBe("string");
      expect(item.sectionId.length).toBeGreaterThan(0);
    }

    // Every item should have a sectionTitle (maybe empty for edge cases, but should exist)
    for (const item of coverageItems) {
      expect(item.sectionTitle).toBeDefined();
      expect(typeof item.sectionTitle).toBe("string");
    }

    // Verify count is correct
    expect(coverageItems.length).toBe(58);
  });

  it("VM0007 coverage queue passes through sectionTitle", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const rulesPath = path.resolve("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
    const rawRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

    const queueRules = rawRules.map((r: Record<string, unknown>) => {
      const ctx = r.section_context as Record<string, unknown> | undefined;
      const summary = (r.summary as string) || (r.title as string) || "";
      const sid = ((ctx?.section_id as string) ?? "") as string;
      return {
        id: r.stable_id as string,
        title: summary,
        tags: [],
        sectionTitle: (ctx?.section_title as string) ?? "",
      };
    });

    const summary = buildCoverageQueue({ rules: queueRules, coveredRuleIds: new Set(), limit: 58 });

    // All 58 should be uncovered
    expect(summary.total).toBe(58);
    expect(summary.uncovered).toBe(58);

    // Every uncovered item should have title != id
    for (const item of summary.topUncovered) {
      expect(item.title).not.toBe(item.id);
      expect(item.title.length).toBeGreaterThan(0);
    }

    // Section titles should exist for most rules
    const titlesWithSection = summary.topUncovered.filter((r) => r.sectionTitle).length;
    expect(titlesWithSection).toBeGreaterThan(50);
  });
});
