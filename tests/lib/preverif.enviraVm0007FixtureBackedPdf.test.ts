import { describe, expect, it } from "@jest/globals";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import { buildEnviraVm0007FixtureBackedPdf, buildReportLines } from "@/lib/preverif/enviraVm0007FixtureBackedPdf";

describe("buildEnviraVm0007FixtureBackedPdf", () => {
  it("returns a blocked-only PDF when the legacy mismatch report is version-blocked", async () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const pdf = buildEnviraVm0007FixtureBackedPdf(report);
    const parsed = await extractPdfTextWithPdfParse({ bytes: pdf });
    const text = parsed.text;
    const lower = text.toLowerCase();
    const lines = buildReportLines(report);
    const collapsedLines = lines.join(" ").replace(/\s+/g, " ").trim();
    const collapsedText = text.replace(/\s+/g, " ").trim();

    expect(lines.join("\n")).toContain("Version mismatch blocked");
    expect(collapsedLines).toContain("Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.");
    expect(lines.join("\n")).toContain("Blocked output only. No evidence map or summary counts are rendered.");
    expect(lines.join("\n")).not.toContain("FOUND: 30");
    expect(lines.join("\n")).not.toContain("Priority Client Actions");
    expect(lines.join("\n")).not.toContain("Evidence Map");

    expect(text).toContain("Version mismatch blocked");
    expect(collapsedText).toContain("Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.");
    expect(text).toContain("Quarantine label: Legacy v1.5 mismatch regression fixture");
    expect(text).toContain("PDD-declared methodology version: REDD-MF / VM0007 v1.5");
    expect(text).toContain("Loaded rulebook version: VM0007 v1.8");
    expect(text).toContain("versionMatch: false");
    expect(text).not.toContain("FOUND: 30");
    expect(text).not.toContain("UNCLEAR: 8");
    expect(text).not.toContain("MISSING: 3");
    expect(text).not.toContain("N/A: 17");
    expect(text).not.toContain("Priority Client Actions");
    expect(text).not.toContain("Evidence Map");

    for (const banned of ["client ready", "ready for verification", "verified", "all clear"]) {
      expect(lower).not.toContain(banned);
    }
  }, 20000);
});
