import { describe, expect, it } from "@jest/globals";
import { normalizeDeclaredMethodologyVersion, normalizeMethodologyVersion } from "@/lib/chat/methodologyVersion";

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

  it("canonicalizes VM0007 methodology version variants to v1.8", () => {
    expect(normalizeMethodologyVersion("v1-8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("v1.8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("1.8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("Version 1.8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("VM0007 v1.8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("REDD+ MF 1.8")).toBe("v1.8");
    expect(normalizeMethodologyVersion("Methodology VM0007 REDD+ Methodology Framework (REDD+ MF) 1.8")).toBe("v1.8");
  });

  it("does not treat trailing module or tool versions as methodology versions", () => {
    expect(normalizeMethodologyVersion("The project applies VM0007 and module VMD0001 1.8")).toBeNull();
    expect(normalizeMethodologyVersion("The project applies REDD+ MF and tool VT0001 1.8")).toBeNull();
  });
});
