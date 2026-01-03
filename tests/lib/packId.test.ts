import { describe, expect, test } from "@jest/globals";
import { equalsPack, extractPackId } from "@/lib/packId";

describe("extractPackId", () => {
  test("extracts pack id from tag", () => {
    expect(extractPackId("methodologies-pack-3ea9dc32bfaf")).toBe("3ea9dc32bfaf");
  });

  test("normalizes hex sha input", () => {
    expect(extractPackId("3EA9DC32BFAF")).toBe("3ea9dc32bfaf");
  });

  test("returns null for non-hex input", () => {
    expect(extractPackId("not-a-sha")).toBeNull();
  });
});

describe("equalsPack", () => {
  test("matches tag and id", () => {
    expect(equalsPack("methodologies-pack-3ea9dc32bfaf", "3ea9dc32bfaf")).toBe(true);
  });

  test("matches with case differences", () => {
    expect(equalsPack("methodologies-pack-3EA9DC32BFAF", "3ea9dc32bfaf")).toBe(true);
  });

  test("mismatches unrelated tags", () => {
    expect(equalsPack("methodologies-pack-aaaaaaaaaaaa", "bbbbbbbbbbbb")).toBe(false);
  });
});

