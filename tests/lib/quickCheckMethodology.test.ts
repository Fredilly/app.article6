import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { prioritizeMethodologyMentions, resolvePrimaryMethodology, resolveQuickCheckMethodology } from "@/lib/chat/quickCheckMethodology";
import { resolveMethodologyDeclarationFromText } from "@/lib/quickCheckV2/methodologyParsing";
import { extractMethodologyMentions } from "@/lib/chat/quickCheckEvidence";

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
    expect(result.matchedMethods[0]?.methodologyVersion).toBeNull();
    expect(result.matchedMethods[0]?.versionStatus).toBe("VERSION_NOT_CONFIRMED");
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

describe("methodology declaration version resolution", () => {
  const fixtureRoot = path.join(process.cwd(), "tests/fixtures/quick-check/v2/methodology-version-provenance");
  const read = (name: string) => fs.readFileSync(path.join(fixtureRoot, name), "utf8");

  it("confirms a formal VM0007 v1.8 row", () => {
    expect(resolveMethodologyDeclarationFromText(read("formal-vm0007-v18.txt"), "VM0007")).toMatchObject({
      version: "v1.8",
      status: "VERSION_CONFIRMED",
    });
  });

  it("ignores PDD Version 1.3 when the formal row declares VM0007 v1.8", () => {
    expect(resolveMethodologyDeclarationFromText(read("document-and-formal-vm0007.txt"), "VM0007")).toMatchObject({
      version: "v1.8",
      status: "VERSION_CONFIRMED",
    });
  });

  it("returns a detected methodology with no confirmed version", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["VM0007"],
      methods,
      rawText: read("vm0007-without-version.txt"),
    });
    expect(result.matchedMethods[0]).toMatchObject({
      methodologyId: "VM0007",
      methodologyVersion: null,
      versionStatus: "VERSION_NOT_CONFIRMED",
    });
  });

  it("does not use module or tool versions for VM0007", () => {
    expect(resolveMethodologyDeclarationFromText(read("module-tool-versions.txt"), "VM0007")).toMatchObject({
      version: null,
      status: "VERSION_NOT_CONFIRMED",
    });
  });

  it("keeps the existing Marcondes declaration confirmed", () => {
    const marcondes = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/quick-check/v2/marcondes-pdd/extracted.txt"),
      "utf8",
    );
    expect(resolveMethodologyDeclarationFromText(marcondes, "VM0007")).toMatchObject({
      version: "v1.8",
      status: "VERSION_CONFIRMED",
    });
  });
});

const contextMethods = [
  { code: "VM0004", latestVersion: "v1-0", versions: ["v1-0"] },
  { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
];

describe("primary methodology resolver", () => {
  it("ranks the applied methodology from heading context for VM0007", () => {
    const rawText = [
      "Title and Reference of Methodology",
      "VM0007",
      "Supporting references mention AM0001 and AM0003 in footnotes.",
    ].join("\n");
    const result = resolvePrimaryMethodology({
      mentions: ["VM0007", "AM0001", "AM0003"],
      methods: [...contextMethods],
      rawText,
    });
    expect(result?.supported).toBe(true);
    if (result?.supported) expect(result.matchedMethod.methodologyId).toBe("VM0007");
  });

  it("Kariba-style PDD resolves VM0009 as primary despite other methodology references", () => {
    const rawText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/kariba-primary-method.txt"), "utf-8");
    const mentions = extractMethodologyMentions(rawText);
    const result = resolvePrimaryMethodology({
      mentions,
      methods: [{ code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] }],
      rawText,
    });
    expect(result).toEqual(expect.objectContaining({
      canonicalKey: "VM0009",
      supported: false,
    }));
  });

  it("Kasigau-style PDD resolves VM0009 as primary", () => {
    const rawText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/kasigau-primary-method.txt"), "utf-8");
    const mentions = extractMethodologyMentions(rawText);
    const result = resolvePrimaryMethodology({
      mentions,
      methods: [{ code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] }],
      rawText,
    });
    expect(result?.canonicalKey).toBe("VM0009");
  });

  it("Rimba Raya-style PDD resolves VM0004 as primary", () => {
    const rawText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/rimba-raya-primary-method.txt"), "utf-8");
    const mentions = extractMethodologyMentions(rawText);
    const result = resolvePrimaryMethodology({
      mentions,
      methods: [{ code: "VM0004", latestVersion: "v1-0", versions: ["v1-0"] }],
      rawText,
    });
    expect(result?.canonicalKey).toBe("VM0004");
    expect(result?.supported).toBe(true);
  });

  it("existing PD_REDD fixture resolves VM0007 as primary", () => {
    const rawText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/pd_redd_v1_130-extracted.txt"), "utf-8");
    const mentions = extractMethodologyMentions(rawText);
    const result = resolvePrimaryMethodology({
      mentions,
      methods: methods,
      rawText,
    });
    expect(result?.canonicalKey).toBe("VM0007");
    expect(result?.supported).toBe(true);
  });

  it("does not fall back to a supported secondary when the primary methodology is unsupported", () => {
    const rawText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/kariba-primary-method.txt"), "utf-8");
    const mentions = extractMethodologyMentions(rawText);
    const result = resolveQuickCheckMethodology({
      mentions,
      methods: methods,
      rawText,
    });
    expect(result.status).toBe("unsupported");
    expect(result.primaryMethodology?.canonicalKey).toBe("VM0009");
    expect(result.matchedMethods.map((method) => method.methodologyId)).not.toContain("VM0007");
  });
});
