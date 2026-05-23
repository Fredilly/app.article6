import {
  resolveMethodologySignals,
  gatingMethodCodes,
  gatingLabel,
  buildMethodProgramMap,
  type MethodInventoryRecord,
} from "@/lib/chat/quickCheckMethodSignals";

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeInventory(codes: string[]): Set<string> {
  return new Set(codes);
}

function makeMethodRecords(codes: string[]): MethodInventoryRecord[] {
  return codes.map((code) => ({
    code,
    versions: ["v1-0"],
    latestVersion: "v1-0",
  }));
}

// ─── Tier 1: Primary methodology signals ─────────────────────────────────

describe("Primary methodology signals (Tier 1)", () => {
  describe("VM0007 exact code", () => {
    it("detects VM0007 from exact code in mentions", () => {
      const result = resolveMethodologySignals(
        ["VM0007"],
        makeInventory(["VM0007", "ACM0010", "AR-ACM0003"]),
      );
      expect(result.exactlyOne).toBe(true);
      expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
      expect(result.detectedMethods[0]!.confidence).toBe("exact-code");
    });

    it("detects VM0007 when mixed case", () => {
      const result = resolveMethodologySignals(
        ["vm0007"],
        makeInventory(["VM0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    });
  });

  describe("REDD+ MF alias → VM0007", () => {
    it("resolves REDD+ MF to VM0007", () => {
      const result = resolveMethodologySignals(
        ["REDD+ MF"],
        makeInventory(["VM0007"]),
      );
      expect(result.exactlyOne).toBe(true);
      expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
      expect(result.detectedMethods[0]!.confidence).toBe("alias");
      expect(result.detectedMethods[0]!.sourceMention).toBe("REDD+ MF");
    });

    it("resolves REDD+ Methodology Framework to VM0007", () => {
      const result = resolveMethodologySignals(
        ["REDD+ Methodology Framework"],
        makeInventory(["VM0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    });

    it("resolves lowercase redd+ methodology framework", () => {
      const result = resolveMethodologySignals(
        ["redd+ methodology framework"],
        makeInventory(["VM0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    });
  });

  describe("ACM0010 detection", () => {
    it("detects ACM0010 exact code", () => {
      const result = resolveMethodologySignals(
        ["ACM0010"],
        makeInventory(["ACM0010", "VM0007"]),
      );
      expect(result.exactlyOne).toBe(true);
      expect(result.detectedMethods[0]!.methodCode).toBe("ACM0010");
      expect(result.detectedMethods[0]!.confidence).toBe("exact-code");
    });

    it("resolves ACM 0010 (with space) via alias", () => {
      const result = resolveMethodologySignals(
        ["ACM 0010"],
        makeInventory(["ACM0010", "VM0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("ACM0010");
      expect(result.detectedMethods[0]!.confidence).toBe("alias");
    });
  });

  describe("UNFCCC Forestry codes", () => {
    it("detects AR-ACM0003 exact code", () => {
      const result = resolveMethodologySignals(
        ["AR-ACM0003"],
        makeInventory(["AR-ACM0003", "VM0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("AR-ACM0003");
      expect(result.detectedMethods[0]!.confidence).toBe("exact-code");
    });

    it("detects AR-AMS0007 exact code", () => {
      const result = resolveMethodologySignals(
        ["AR-AMS0007"],
        makeInventory(["AR-AMS0007"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("AR-AMS0007");
    });

    it("detects AR-AMS0003 exact code", () => {
      const result = resolveMethodologySignals(
        ["AR-AMS0003"],
        makeInventory(["AR-AMS0003"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("AR-AMS0003");
    });

    it("detects AR-AM0014 exact code", () => {
      const result = resolveMethodologySignals(
        ["AR-AM0014"],
        makeInventory(["AR-AM0014"]),
      );
      expect(result.detectedMethods[0]!.methodCode).toBe("AR-AM0014");
    });
  });
});

// ─── Tier 2: Program signals ────────────────────────────────────────────

describe("Program signals (Tier 2)", () => {
  it("detects Verra as program only (no method resolution)", () => {
    const result = resolveMethodologySignals(
      ["Verra"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    expect(result.noMethodDetected).toBe(true);
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("Verra");
  });

  it("detects VCS as Verra program", () => {
    const result = resolveMethodologySignals(
      ["VCS"],
      makeInventory(["VM0007"]),
    );
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("Verra");
  });

  it("detects CCB as Verra program", () => {
    const result = resolveMethodologySignals(
      ["CCB"],
      makeInventory(["VM0007"]),
    );
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("Verra");
  });

  it("detects UNFCCC as program only", () => {
    const result = resolveMethodologySignals(
      ["UNFCCC"],
      makeInventory(["AR-ACM0003", "ACM0010"]),
    );
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("UNFCCC");
  });

  it("detects Gold Standard as program only", () => {
    const result = resolveMethodologySignals(
      ["Gold Standard"],
      makeInventory(["GS-00XX"]),
    );
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("GoldStandard");
  });

  it("detects GS4GG as GoldStandard program", () => {
    const result = resolveMethodologySignals(
      ["GS4GG"],
      makeInventory(["GS-00XX"]),
    );
    expect(result.programOnly).toBe(true);
    expect(result.detectedPrograms[0]!.program).toBe("GoldStandard");
  });

  it("Verified Carbon Standard detects as Verra program", () => {
    const result = resolveMethodologySignals(
      ["Verified Carbon Standard"],
      makeInventory(["VM0007"]),
    );
    expect(result.detectedPrograms[0]?.program).toBe("Verra");
  });
});

// ─── Tier 3: Activity signals — MUST NOT resolve to methods ──────────────

describe("Activity/module signals (Tier 3) — must not resolve to methods", () => {
  const inventory = makeInventory(["VM0007", "AR-ACM0003"]);

  it("APD alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["APD"], inventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    expect(result.activitySignals).toHaveLength(1);
    expect(result.activitySignals[0]!.kind).toBe("APD");
  });

  it("ARR alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["ARR"], inventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    expect(result.activitySignals[0]!.kind).toBe("ARR");
  });

  it("RWE alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["RWE"], inventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.activitySignals[0]!.kind).toBe("RWE");
  });

  it("APWD alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["APWD"], inventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.activitySignals[0]!.kind).toBe("APWD");
  });

  it("VMD0001 alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["VMD0001"], inventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.activitySignals[0]!.kind).toBe("VMD-module");
  });

  it("VMD0006 alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["VMD0006"], inventory);
    expect(result.noMethodDetected).toBe(true);
  });

  it("VMD0009 alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["VMD0009"], inventory);
    expect(result.noMethodDetected).toBe(true);
  });

  it("VMR001 alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["VMR001"], inventory);
    expect(result.noMethodDetected).toBe(true);
  });

  it("VMR1234 alone does NOT resolve to VM0007", () => {
    const result = resolveMethodologySignals(["VMR1234"], inventory);
    expect(result.noMethodDetected).toBe(true);
  });

  it("activitySignalsOnly is true when only Tier 3 signals present", () => {
    const result = resolveMethodologySignals(["APD", "ARR", "VMD0001"], inventory);
    expect(result.activitySignalsOnly).toBe(true);
  });
});

// ─── Combined signals ────────────────────────────────────────────────────

describe("Combined signals", () => {
  it("VM0007 + activity signals → only VM0007 detected as method", () => {
    const result = resolveMethodologySignals(
      ["VM0007", "APD", "VMD0001", "ARR"],
      makeInventory(["VM0007", "AR-ACM0003"]),
    );
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    // Activity signals still recorded for potential boosting
    expect(result.activitySignals.length).toBeGreaterThan(0);
  });

  it("REDD+ MF + VMD0009 → VM0007 detected (VMD is activity, REDD+ MF is primary)", () => {
    const result = resolveMethodologySignals(
      ["REDD+ MF", "VMD0009"],
      makeInventory(["VM0007"]),
    );
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    // VMD0009 is recorded as activity signal
    expect(result.activitySignals.some((s) => s.kind === "VMD-module")).toBe(true);
  });

  it("multiple primary methods → multiplePossible is true", () => {
    const result = resolveMethodologySignals(
      ["VM0007", "ACM0010"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    expect(result.multiplePossible).toBe(true);
    expect(result.canonicalCodes).toContain("VM0007");
    expect(result.canonicalCodes).toContain("ACM0010");
  });

  it("deduplicates multiple mentions of same method", () => {
    const result = resolveMethodologySignals(
      ["VM0007", "VM0007", "REDD+ MF"],
      makeInventory(["VM0007"]),
    );
    expect(result.exactlyOne).toBe(true);
    expect(result.canonicalCodes).toEqual(["VM0007"]);
  });
});

// ─── Gating behavior ─────────────────────────────────────────────────────

describe("gatingMethodCodes", () => {
  it("returns single code when exactly one method detected", () => {
    const signals = resolveMethodologySignals(
      ["VM0007"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    const gated = gatingMethodCodes(signals);
    expect(gated).toEqual(["VM0007"]);
  });

  it("returns all detected codes when multiple methods", () => {
    const signals = resolveMethodologySignals(
      ["VM0007", "ACM0010"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    const gated = gatingMethodCodes(signals);
    expect(gated).toContain("VM0007");
    expect(gated).toContain("ACM0010");
    expect(gated).toHaveLength(2);
  });

  it("returns null when no method detected (broad match)", () => {
    const signals = resolveMethodologySignals(
      ["Some Project"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    const gated = gatingMethodCodes(signals);
    expect(gated).toBeNull();
  });

  it("returns null when only activity signals present", () => {
    const signals = resolveMethodologySignals(
      ["APD", "ARR"],
      makeInventory(["VM0007"]),
    );
    const gated = gatingMethodCodes(signals);
    expect(gated).toBeNull();
  });
});

// ─── Gating label ────────────────────────────────────────────────────────

describe("gatingLabel", () => {
  it("returns detected method label for single method", () => {
    const signals = resolveMethodologySignals(
      ["VM0007"],
      makeInventory(["VM0007"]),
    );
    expect(gatingLabel(signals)).toBe("Detected VM0007");
  });

  it("returns needs-confirmation for multiple methods", () => {
    const signals = resolveMethodologySignals(
      ["VM0007", "ACM0010"],
      makeInventory(["VM0007", "ACM0010"]),
    );
    const label = gatingLabel(signals);
    expect(label).toContain("needs confirmation");
    expect(label).toContain("VM0007");
    expect(label).toContain("ACM0010");
  });

  it("returns null when no detection (broad match)", () => {
    const signals = resolveMethodologySignals(
      ["Nothing relevant"],
      makeInventory(["VM0007"]),
    );
    expect(gatingLabel(signals)).toBeNull();
  });
});

// ─── buildMethodProgramMap ───────────────────────────────────────────────

describe("buildMethodProgramMap", () => {
  it("maps VM-prefixed codes to Verra", () => {
    const map = buildMethodProgramMap(makeMethodRecords(["VM0007", "VM0010"]));
    expect(map.get("VM0007")).toBe("Verra");
    expect(map.get("VM0010")).toBe("Verra");
  });

  it("maps AR-/AM-/ACM-prefixed codes to UNFCCC", () => {
    const map = buildMethodProgramMap(
      makeMethodRecords(["AR-ACM0003", "ACM0010", "AM0073"]),
    );
    expect(map.get("AR-ACM0003")).toBe("UNFCCC");
    expect(map.get("ACM0010")).toBe("UNFCCC");
    expect(map.get("AM0073")).toBe("UNFCCC");
  });

  it("maps GS-prefixed codes to GoldStandard", () => {
    const map = buildMethodProgramMap(makeMethodRecords(["GS-00XX"]));
    expect(map.get("GS-00XX")).toBe("GoldStandard");
  });
});

// ─── Regression: PLUM scenario ───────────────────────────────────────────

describe("PLUM regression tests", () => {
  const fullInventory = makeInventory([
    "VM0007",
    "ACM0010",
    "AR-ACM0003",
    "AR-AMS0007",
    "AR-AMS0003",
    "AR-AM0014",
    "GS-00XX",
  ]);

  it("PLUM excerpt with VM0007 → only VM0007 candidates gated", () => {
    // Simulates a PLUM PDD that mentions VM0007
    const mentions = ["VM0007", "Verra", "VCS", "CCB", "ARR", "REDD+"];
    const result = resolveMethodologySignals(mentions, fullInventory);
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    const gated = gatingMethodCodes(result);
    expect(gated).toEqual(["VM0007"]);
  });

  it("PLUM excerpt with REDD+ MF → resolves to VM0007 only", () => {
    const mentions = ["REDD+ Methodology Framework", "VCS", "APD", "ARR"];
    const result = resolveMethodologySignals(mentions, fullInventory);
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    const gated = gatingMethodCodes(result);
    expect(gated).toEqual(["VM0007"]);
  });

  it("APD/ARR/RWE/APWD alone → no VM0007 resolution (broad match)", () => {
    const mentions = ["APD", "ARR", "RWE"];
    const result = resolveMethodologySignals(mentions, fullInventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    const gated = gatingMethodCodes(result);
    expect(gated).toBeNull();
  });

  it("VMD0001/VMD0006/VMD0009 alone → no VM0007 resolution", () => {
    const mentions = ["VMD0001", "VMD0006"];
    const result = resolveMethodologySignals(mentions, fullInventory);
    expect(result.noMethodDetected).toBe(true);
  });

  it("VM0007 not in inventory → not detected (caller handles unavailable)", () => {
    // When VM0007 is not in the method inventory, the resolver does not
    // detect it as a primary method. The caller should check:
    // "was a method mentioned that we don't have a pack for?"
    const smallInventory = makeInventory(["ACM0010", "AR-ACM0003"]);
    const result = resolveMethodologySignals(["VM0007"], smallInventory);
    // VM0007 is NOT detected — it's not in inventory
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    // The caller should separately check: does the evidence mention a method
    // that isn't in our inventory? (This is done by comparing raw mentions
    // against known method code patterns)
  });

  it("no ACM0010/UNFCCC candidates leak when VM0007 detected", () => {
    const mentions = ["VM0007", "REDD+ MF"];
    const result = resolveMethodologySignals(mentions, fullInventory);
    expect(result.detectedMethods).toHaveLength(1);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    // No UNFCCC codes detected
    expect(
      result.canonicalCodes.some((c) => c.startsWith("AR-") || c === "ACM0010"),
    ).toBe(false);
  });
});
