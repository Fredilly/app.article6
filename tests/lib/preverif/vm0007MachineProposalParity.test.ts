import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { buildVm0007MachineProposal } from "@/lib/preverif/vm0007MachineProposal";

describe("VM0007 machine proposal generation parity", () => {
  it("is deterministic for the same PDF SHA, app version, and generation config", async () => {
    const appVersion = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;
    const rawPddText = [
      "Maya Forest Corridor REDD Belize",
      "Methodology: VM0007 v1.8",
      "Project description and baseline evidence.",
      "Section 1 Project Description",
      "The project area is forest land and the project activity is REDD.",
    ].join("\n");
    const rulesResult = await loadMethodRules("VM0007", "v1-8");
    const config = {
      appVersion,
      auditId: "parity-fixed-audit",
      generatedAt: "2026-01-01T00:00:00.000Z",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      evidenceFileName: "maya-forest-corridor-redd-belize.pdf",
      sourcePdfSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
      rawPddText,
      rules: rulesResult.rules,
    } as const;

    const first = buildVm0007MachineProposal(config);
    const second = buildVm0007MachineProposal(config);

    expect(first.draft.ok).toBe(true);
    expect(second.draft.ok).toBe(true);
    if (!first.draft.ok || !second.draft.ok) return;
    expect(first.draft.package.rows).toHaveLength(58);
    expect(second.draft.package.rows).toHaveLength(58);
    expect(first.draft.package).toEqual(second.draft.package);
    expect(first.sourceDocument).toEqual(second.sourceDocument);
    expect(first.audit).toEqual(second.audit);
  });

  it("keeps machine evidence and applicability separate from reviewer outcomes", async () => {
    const rawPddText = "Project description without an independently detected methodology.";
    const rulesResult = await loadMethodRules("VM0007", "v1-8");
    const built = buildVm0007MachineProposal({
      auditId: "truth-boundary-audit",
      generatedAt: "2026-01-01T00:00:00.000Z",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      methodology: {
        methodologyId: "VM0007",
        methodologyName: "VM0007",
        methodologyAlias: null,
        pddDeclaredMethodologyVersion: "v1.8",
        versionStatus: "DECLARED",
        evidencePage: 1,
        evidenceSection: "Caller resolution",
        evidenceQuote: "Caller-resolved VM0007 v1.8",
      },
      rawPddText,
      rules: rulesResult.rules,
    });

    expect(built.methodology?.methodologyId).toBe("VM0007");
    expect(built.draft.ok).toBe(true);
    if (!built.draft.ok) return;
    expect(built.draft.package.rows).toHaveLength(58);
    expect(built.draft.package).not.toHaveProperty("outcomeCounts");
    expect(built.draft.package.rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "reviewerOutcome"))).toBe(true);
    expect(built.draft.package.rows.every((row) => ["FOUND", "UNCLEAR", "MISSING"].includes(row.proposedEvidenceStatus))).toBe(true);
    expect(built.draft.package.rows.every((row) => ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"].includes(row.proposedApplicability))).toBe(true);
  });

  it("preserves the Maya canonical evidence-state counts", () => {
    const rawPddText = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/extracted.txt"),
      "utf8",
    );
    return loadMethodRules("VM0007", "v1-8").then((rulesResult) => {
      const built = buildVm0007MachineProposal({
        auditId: "maya-counts-audit",
        generatedAt: "2026-01-01T00:00:00.000Z",
        methodologyId: "VM0007",
        methodologyVersion: "v1-8",
        rawPddText,
        rules: rulesResult.rules,
      });
      expect(built.draft.ok).toBe(true);
      if (!built.draft.ok) return;
      const counts = built.draft.package.rows.reduce<Record<string, number>>((result, row) => {
        result[row.proposedEvidenceStatus] = (result[row.proposedEvidenceStatus] ?? 0) + 1;
        return result;
      }, { FOUND: 0, UNCLEAR: 0, MISSING: 0 });
      expect(built.draft.package.rows).toHaveLength(58);
      expect(counts).toEqual({ FOUND: 0, UNCLEAR: 44, MISSING: 14 });
      expect(built.draft.package).not.toHaveProperty("outcomeCounts");
      expect(built.draft.package.rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "reviewerOutcome"))).toBe(true);
    });
  });
});
