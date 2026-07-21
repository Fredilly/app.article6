import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import MarcondesPreValidationReadinessPage from "@/app/internal/reports/prevalidation/marcondes/[auditId]/page";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const sha = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(fixtureDir, name))).digest("hex");

describe("Marcondes client-facing pre-validation readiness route", () => {
  it("renders the report, frozen counts, methodology warning, and all 58 rules", async () => {
    const html = renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) }));
    expect(html).toContain("Marcondes VM0007 v1.8 Pre-Validation Readiness Report");
    expect(html).toContain("Download PDF Report");
    expect(html).toContain('href="/api/exports/internal/marcondes-prevalidation-report"');
    expect(html).toContain("6");
    expect(html).toContain("21");
    expect(html).toContain("9");
    expect(html).toContain("22");
    expect(html).toContain("VM0007 v1.7");
    expect(html).toContain("Tables 30 and 31 declare VM0007 v1.8");
    expect(html).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect(html).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect((html.match(/data-testid=\"readiness-rule\"/g) ?? []).length).toBe(58);
    expect(html).not.toContain("Manual review replaced");
    expect(html).not.toContain("machine-selected evidence");
    expect(html).toContain("The reviewed evidence was assessed against the methodology requirement.");
    expect(html).toContain("Rejected evidence");
    expect(html).toContain("Reason rejected:");
    expect(html).toContain("CIW tidal wetland conservation activities");
    expect(html).toContain("Total action required");
    expect(html).toContain("Unclear evidence");
    expect(html).toContain("Missing evidence");
    expect(html).toContain("Other actions");
    expect(html).toContain("58 rules reviewed");
    expect(html).toContain("Why it matters");
    expect(html).toContain("Required action");
    expect(html).toContain("<strong>Rule ID:</strong> R-1-0012");
    expect(html).toContain("<strong>Title:</strong>");
    expect(html).toContain("Evidence status");
    expect(html).toContain("Reviewer outcome");
    expect(html).toContain("Accepted evidence");
    expect(html).toContain("Rejected evidence");
    expect(html).not.toContain("<strong>Title</strong>");
    expect(html).not.toContain("<strong>Recommended action</strong>");
    expect(html).not.toContain("<strong>Requirement:</strong>");
    expect(html).not.toMatch(/machine-selected|machine proposal|machine-generated|truncated evidence|mislocated evidence|blind audit|re-adjudication|replaced the machine|corrected the machine/i);
    expect((html.match(/data-testid=\"priority-gap-card\"/g) ?? []).length).toBe(30);
    expect(html).toContain("data-testid=\"priority-gap-group-missing-evidence\"");
    expect(html).toContain("data-testid=\"priority-gap-group-unclear-evidence\"");
    expect(html).toContain("data-testid=\"priority-gap-group-other-actions\"");
    const visibleMarkup = html.replace(/ data-rule-id="[^"]+"/g, "");
    expect(visibleMarkup).not.toContain("Verra.AFOLU.VM0007.v1-8.");
  });

  it("exposes the Evidence Map navigation link and preserves truth artifact hashes", () => {
    const evidenceMapPage = fs.readFileSync(path.join(process.cwd(), "src/components/preverif/Vm0007EvidenceMapDraftPage.tsx"), "utf8");
    expect(evidenceMapPage).toContain("View Pre-Validation Readiness Report");
    expect(evidenceMapPage).toContain("/internal/reports/prevalidation/marcondes/");
    expect(sha("gold.json")).toBe("ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511");
    expect(sha("machine-proposal.json")).toBe("068731582d28bd73b35af18b67724fd45ef35964a2965de5aaf2cfb26ff65bf6");
    expect(sha("raw-evidence-map.json")).toBe("bd71459647c878855a9ebfe1fe3d6af6e9ec5c8ba89464091bc06ee0dbfe649e");
  });

  it("keeps the finalized counts, outcomes, IDs, and rejected evidence in the report model", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    expect(report.rules).toHaveLength(58);
    expect(report.executiveSummary.evidenceStateCounts).toEqual({ FOUND: 6, UNCLEAR: 21, MISSING: 9, "N/A": 22 });
    expect(report.executiveSummary.reviewerOutcomeCounts).toEqual({ CONFORMS: 6, ACTION_REQUIRED: 30, NOT_APPLICABLE: 22, NOT_ASSESSED: 0 });
    expect(report.rules.every((rule) => rule.ruleId.startsWith("Verra.AFOLU.VM0007.v1-8.") && rule.displayTitle.length > 0 && rule.displayRequirement.length > 0)).toBe(true);
    const gold = JSON.parse(fs.readFileSync(path.join(fixtureDir, "gold.json"), "utf8"));
    expect(report.rules.map((rule) => rule.acceptedEvidence)).toEqual(gold.rows.map((row: { acceptedEvidence: unknown[] }) => row.acceptedEvidence));
    expect(report.rules.map((rule) => rule.rejectedEvidence)).toEqual(gold.rows.map((row: { rejectedEvidence: unknown[] }) => row.rejectedEvidence));
  });

  it("identifies truth-backed duplicate rationale and client action values without changing them", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    expect(report.rules.filter((rule) => rule.rationale.trim() === (rule.recommendedAction ?? "").trim()).map((rule) => rule.ruleId)).toEqual([
      "Verra.AFOLU.VM0007.v1-8.R-5-0006",
      "Verra.AFOLU.VM0007.v1-8.R-5-0007",
      "Verra.AFOLU.VM0007.v1-8.R-5-0009",
      "Verra.AFOLU.VM0007.v1-8.R-6-0003",
      "Verra.AFOLU.VM0007.v1-8.R-6-0004",
      "Verra.AFOLU.VM0007.v1-8.R-6-0006",
      "Verra.AFOLU.VM0007.v1-8.R-6-0007",
    ]);
  });

  it("separates why-it-matters text from required action when the frozen wording duplicates", async () => {
    const html = renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) }));
    const gold = JSON.parse(fs.readFileSync(path.join(fixtureDir, "gold.json"), "utf8"));
    const duplicateRows = gold.rows.filter((row: { reviewerOutcome: string; reviewerCorrection?: { correction?: string }; clientAction?: string }) => {
      if (row.reviewerOutcome !== "ACTION_REQUIRED" || !row.clientAction) return false;
      const rationale = row.reviewerCorrection?.correction ?? "";
      return rationale.trim().toLowerCase() === row.clientAction.trim().toLowerCase();
    });
    expect(duplicateRows.length).toBeGreaterThan(0);
    for (const row of duplicateRows) expect(html).toContain(`<strong>Required action:</strong> ${row.clientAction}`);
  });
});
