import { describe, expect, it } from "vitest";
import { formatJsonValue } from "@/lib/query/format";

describe("formatJsonValue", () => {
  it("formats primitives", () => {
    expect(formatJsonValue("hello")).toBe("hello");
    expect(formatJsonValue(42)).toBe("42");
    expect(formatJsonValue(true)).toBe("true");
    expect(formatJsonValue(null)).toBe("null");
  });

  it("joins arrays", () => {
    expect(formatJsonValue(["a", "b"])).toBe("a, b");
  });

  it("stringifies objects", () => {
    expect(formatJsonValue({ a: 1, b: "c" })).toBe('{"a":1,"b":"c"}');
  });
});
