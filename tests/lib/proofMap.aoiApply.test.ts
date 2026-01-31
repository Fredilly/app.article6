import { shouldResetDerivedState } from "@/lib/proofMap/aoiApply";

describe("shouldResetDerivedState", () => {
  it("respects explicit resetDerived false when hashes match", () => {
    expect(shouldResetDerivedState({ currentHash: "hash-1", nextHash: "hash-1", resetDerived: false })).toBe(false);
  });

  it("respects explicit resetDerived true when hashes match", () => {
    expect(shouldResetDerivedState({ currentHash: "hash-1", nextHash: "hash-1", resetDerived: true })).toBe(true);
  });

  it("defaults to reset when hashes differ or missing", () => {
    expect(shouldResetDerivedState({ currentHash: "hash-1", nextHash: "hash-2" })).toBe(true);
    expect(shouldResetDerivedState({ currentHash: null, nextHash: "hash-2" })).toBe(true);
  });
});
