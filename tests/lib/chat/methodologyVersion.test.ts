import { describe, expect, it } from "@jest/globals";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

describe("normalizeDeclaredMethodologyVersion", () => {
  it("canonicalizes equivalent document forms to the same internal key", () => {
    expect(normalizeDeclaredMethodologyVersion("v1-0")).toBe("v1.0");
    expect(normalizeDeclaredMethodologyVersion("v1.0")).toBe("v1.0");
    expect(normalizeDeclaredMethodologyVersion("v1")).toBe("v1.0");
    expect(normalizeDeclaredMethodologyVersion("v.4")).toBe("v4.0");
    expect(normalizeDeclaredMethodologyVersion("v4")).toBe("v4.0");
    expect(normalizeDeclaredMethodologyVersion("version 4")).toBe("v4.0");
    expect(normalizeDeclaredMethodologyVersion("version 8")).toBe("v8.0");
    expect(normalizeDeclaredMethodologyVersion("v8")).toBe("v8.0");
  });
});
