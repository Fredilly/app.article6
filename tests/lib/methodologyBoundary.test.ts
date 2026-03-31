import {
  APPROVED_SYNC_BRANCH_PREFIXES,
  evaluateMethodologyBoundary,
  isApprovedMethodologySyncBranch,
} from "@/lib/methodologyBoundary";

describe("methodology boundary guardrails", () => {
  test("passes on normal app-side changes", () => {
    const result = evaluateMethodologyBoundary({
      branchName: "feat/rc3-workbook-ui",
      changedFiles: ["src/components/map/ProofMapTab.tsx", "tests/lib/workbookIntake.test.ts"],
    });

    expect(result.allowed).toBe(true);
    expect(result.messages).toEqual([]);
  });

  test("blocks canonical schema edits in app", () => {
    const result = evaluateMethodologyBoundary({
      branchName: "feat/rc4-monitoring-report-intake",
      changedFiles: ["schemas/artifacts/rules.rich.schema.json"],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedCanonSchemaFiles).toEqual(["schemas/artifacts/rules.rich.schema.json"]);
  });

  test("blocks vendored methodology edits without approved sync path", () => {
    const result = evaluateMethodologyBoundary({
      branchName: "feat/rc4-monitoring-report-intake",
      changedFiles: ["public/methodologies/UNFCCC/Forestry/AR-AMS0003/v01-0/rules.rich.json"],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedVendoredMethodologyFiles).toEqual([
      "public/methodologies/UNFCCC/Forestry/AR-AMS0003/v01-0/rules.rich.json",
    ]);
  });

  test("allows vendored methodology sync on approved sync branch", () => {
    const result = evaluateMethodologyBoundary({
      branchName: `${APPROVED_SYNC_BRANCH_PREFIXES[0]}2026-04-pack-refresh`,
      changedFiles: ["public/methodologies/UNFCCC/Forestry/AR-AMS0003/v01-0/rules.rich.json"],
    });

    expect(result.allowed).toBe(true);
    expect(result.approvedSyncPath).toBe(true);
  });

  test("allows vendored methodology sync with explicit env-style approval", () => {
    const result = evaluateMethodologyBoundary({
      allowMethodologySync: true,
      branchName: "chore/pack-refresh",
      changedFiles: ["public/_provenance/methodologies_PROVENANCE.json"],
    });

    expect(result.allowed).toBe(true);
    expect(result.approvedSyncPath).toBe(true);
  });

  test("recognizes approved methodology sync branch prefixes", () => {
    expect(isApprovedMethodologySyncBranch("sync/methodologies-2026-04-pack-refresh")).toBe(true);
    expect(isApprovedMethodologySyncBranch("feat/rc4-monitoring-report-intake")).toBe(false);
  });
});
