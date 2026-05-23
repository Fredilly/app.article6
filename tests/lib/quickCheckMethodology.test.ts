import { describe, expect, it } from "@jest/globals";
import { prioritizeMethodologyMentions, resolveQuickCheckMethodology } from "@/lib/chat/quickCheckMethodology";

const methods = [
  { code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] },
  { code: "GS-VER1", latestVersion: "v2-0", versions: ["v2-0"] },
  { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
];

describe("quick check methodology resolver", () => {
  it("resolves VM0007 aliases to a single installed methodology", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["Verra", "REDD+ MF", "VM0007"],
      methods,
    });

    expect(result.status).toBe("single");
    expect(result.matchedMethods[0]?.methodologyId).toBe("VM0007");
  });

  it("resolves UNFCCC aliases against AR-prefixed pack codes", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["ACM0003"],
      methods,
    });

    expect(result.status).toBe("single");
    expect(result.matchedMethods[0]?.methodologyId).toBe("AR-ACM0003");
  });

  it("returns multiple when evidence detects more than one installed methodology", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["GS-VER1", "VM0007"],
      methods,
    });

    expect(result.status).toBe("multiple");
    expect(result.matchedMethods.map((method) => method.methodologyId)).toEqual(["VM0007", "GS-VER1"]);
  });

  it("returns unsupported when a detected methodology has no installed pack", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["ACM0010"],
      methods,
    });

    expect(result.status).toBe("unsupported");
    expect(result.unsupportedCanonicalKeys).toEqual(["ACM0010"]);
  });

  it("treats module-only signals as non-methodology evidence", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["APD", "ARR", "VMD0001"],
      methods,
    });

    expect(result.status).toBe("none");
  });

  it("prioritizes direct method signals ahead of modules and program labels", () => {
    expect(
      prioritizeMethodologyMentions(["APD", "VCS", "VM0007", "VMD0001", "REDD+ Methodology Framework"]),
    ).toEqual(["VM0007", "REDD+ Methodology Framework", "VMD0001", "APD", "VCS"]);
  });
});
