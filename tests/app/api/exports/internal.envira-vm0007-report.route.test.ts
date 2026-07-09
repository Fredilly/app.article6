import { describe, expect, it } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/envira-vm0007-report/route";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";

describe("/api/exports/internal/envira-vm0007-report route", () => {
  it("returns a blocked PDF attachment instead of a normal evidence report", async () => {
    const response = await GET();
    const bytes = await response.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });
    const text = parsed.text;
    const lower = text.toLowerCase();
    const collapsedText = text.replace(/\s+/g, " ").trim();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="envira-vm0007-v15-legacy-mismatch-blocked.pdf"');
    expect(text).toContain("Version mismatch blocked");
    expect(collapsedText).toContain("Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.");
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
