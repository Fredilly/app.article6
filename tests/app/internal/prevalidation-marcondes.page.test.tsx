import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import MarcondesPreValidationReadinessPage from "@/app/internal/reports/prevalidation/marcondes/[auditId]/page";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const sha = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(fixtureDir, name))).digest("hex");

describe("Marcondes client-facing pre-validation readiness route", () => {
  it("renders the report, frozen counts, methodology warning, and all 58 rules", async () => {
    const html = renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) }));
    expect(html).toContain("Marcondes VM0007 v1.8 Pre-Validation Readiness Report");
    expect(html).toContain("6");
    expect(html).toContain("21");
    expect(html).toContain("9");
    expect(html).toContain("22");
    expect(html).toContain("VM0007 v1.7");
    expect(html).toContain("Tables 30 and 31 declare VM0007 v1.8");
    expect(html).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect(html).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect((html.match(/data-testid=\"readiness-rule\"/g) ?? []).length).toBe(58);
  });

  it("exposes the Evidence Map navigation link and preserves truth artifact hashes", () => {
    const evidenceMapPage = fs.readFileSync(path.join(process.cwd(), "src/components/preverif/Vm0007EvidenceMapDraftPage.tsx"), "utf8");
    expect(evidenceMapPage).toContain("View Pre-Validation Readiness Report");
    expect(evidenceMapPage).toContain("/internal/reports/prevalidation/marcondes/");
    expect(sha("gold.json")).toBe("ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511");
    expect(sha("machine-proposal.json")).toBe("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
    expect(sha("raw-evidence-map.json")).toBe("bd71459647c878855a9ebfe1fe3d6af6e9ec5c8ba89464091bc06ee0dbfe649e");
  });
});
