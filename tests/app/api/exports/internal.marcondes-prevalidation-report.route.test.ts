import { describe, expect, it } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/marcondes-prevalidation-report/route";

describe("/api/exports/internal/marcondes-prevalidation-report route", () => {
  it("returns the current Marcondes PDF with the stable download filename", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="marcondes-vm0007-v18-prevalidation-readiness-report.pdf"',
    );
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
