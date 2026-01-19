import { describe, expect, test } from "@jest/globals";
import { getWorkspaceWorkFlags } from "@/lib/proofMap/workspace";

describe("proof map workspace flags", () => {
  test("empty workspace reports no work", () => {
    const flags = getWorkspaceWorkFlags({});
    expect(flags.willClearWork).toBe(false);
    expect(flags.hasPins).toBe(false);
    expect(flags.hasSelections).toBe(false);
    expect(flags.hasRuns).toBe(false);
  });

  test("pins present => willClearWork", () => {
    const flags = getWorkspaceWorkFlags({ evidencePins: [{ id: "pin-1" } as any] });
    expect(flags.hasPins).toBe(true);
    expect(flags.willClearWork).toBe(true);
  });

  test("selectedStacItemId present => willClearWork", () => {
    const flags = getWorkspaceWorkFlags({ selectedStacItemId: "stac-1" });
    expect(flags.hasSelections).toBe(true);
    expect(flags.willClearWork).toBe(true);
  });

  test("evidenceSelections present => willClearWork", () => {
    const flags = getWorkspaceWorkFlags({ evidenceSelections: ["x"] });
    expect(flags.hasSelections).toBe(true);
    expect(flags.willClearWork).toBe(true);
  });

  test("evidenceSnapshots present => willClearWork", () => {
    const flags = getWorkspaceWorkFlags({ evidenceSnapshots: [{ id: "snap-1" } as any] });
    expect(flags.hasSelections).toBe(true);
    expect(flags.willClearWork).toBe(true);
  });

  test("verification runs present => willClearWork", () => {
    const flags = getWorkspaceWorkFlags({ verificationRuns: [{ id: "run-1" } as any] });
    expect(flags.hasRuns).toBe(true);
    expect(flags.willClearWork).toBe(true);
  });
});
