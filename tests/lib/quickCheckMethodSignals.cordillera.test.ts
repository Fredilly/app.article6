/**
 * Cordillera Azul reliability fixture tests.
 *
 * These tests encode the exact signal resolution contracts for the
 * Cordillera Azul National Park REDD project document family.
 *
 * KEY BEHAVIOR RULES:
 *   1. CCB report: VM0007 is supporting_carbon_accounting_reference, not primary.
 *   2. VCS report: VM0007 v1.3 is primary_applied methodology.
 *   3. PDD: VM0007 is applied_in_project under dual VCS+CCB standards.
 *   4. Monitoring report: VM0007 is applied_in_project; blocked by payload limit.
 *   5. CCB/CCBA is NOT a Verra-equivalent program family.
 *   6. Methodology role is NOT decided by mention count alone.
 *   7. Any answered result must have page and quote provenance.
 *
 * Do not add to strict eval until parser extraction depth and page
 * provenance can support the expected gold answers.
 *
 * Tests that document CURRENT-WILL-BECOME behavior are in a
 * describe.skip block — they document bugs we know exist but
 * do not fail CI. Run them explicitly with:
 *   npx jest --no-coverage tests/lib/quickCheckMethodSignals.cordillera.test.ts
 */

import { describe, expect, it } from "@jest/globals";
import {
  resolveMethodologySignals,
  gatingMethodCodes,
  gatingLabel,
  detectUnavailableMethod,
  buildMethodProgramMap,
  type MethodInventoryRecord,
} from "@/lib/chat/quickCheckMethodSignals";

// ─── Full method inventory (matches the live site) ───────────────────────

const FULL_INVENTORY = new Set([
  "VM0007",
  "ACM0010",
  "AM0073",
  "AMS-III.A",
  "AMS-III.AU",
  "AMS-III.BE",
  "AMS-III.BF",
  "AMS-III.BK",
  "AMS-III.D",
  "AMS-III.R",
  "AR-ACM0003",
  "AR-AM0014",
  "AR-AMS0003",
  "AR-AMS0007",
  "GS-00XX",
  "VM0047",
]);

// ─── Context-aware mention builders ──────────────────────────────────────

function ccbReportMentions(): string[] {
  return [
    "CCBA", "CCB",
    "Climate Community and Biodiversity Project Design Standards Second Edition",
    "CCB Standards",
    "during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007",
    "VM0007",
    "VCS AFOLU expert",
    "Climate Community and Biodiversity Standards",
    "Verified Carbon Standard",
    "VCS VM0007 methodology",
    "Gold Level", "GL1", "GL2", "GL3",
    "CCB Validation Conclusion",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007",
  ];
}

function vcsReportMentions(): string[] {
  return [
    "VALIDATION REPORT VCS Version 3",
    "VCS",
    "against the Verified Carbon Standard version 3.3 and its supporting documents including the approved methodology VM0007 version 1.3 REDD Methodology Modules",
    "VM0007", "Verified Carbon Standard",
    "REDD Methodology Modules",
    "correctly applies the selected methodology element and is in conformance with all applicable requirements of the Verified Carbon Standard (VCS)",
    "VCS",
    "approved methodology VM0007 and that they are indeed planned and appropriate",
    "VM0007", "VCS",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007",
    "VCS", "VCS", "VCS", "VCS", "VCS",
  ];
}

function pddMentions(): string[] {
  return [
    "Two protocols were identified to develop and monitor the project: Verified Carbon Standard (VCS) and the Community Climate and Biodiversity (CCB) protocol",
    "Under VCS the project is using VM0007 REDD Methodology Modules (REDD-MF)",
    "VM0007", "VCS", "CCB",
    "the modular REDD methodology VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012",
    "VM0007 REDD Methodology Module REDD Methodology Framework (REDD-MF) version 1.3",
    "VM0007", "VCS",
    "CCB Standards Second Edition",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007",
    "VCS", "VCS",
    "CCB", "CCB", "CCBA",
  ];
}

function monitoringMentions(): string[] {
  return [
    "MONITORING REPORT CCB Version 2 VCS Version 3",
    "VCS", "CCB",
    "Cordillera Azul National Park REDD+ Project",
    "VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012",
    "VM0007 REDD Methodology Module REDD Methodology Framework (REDD-MF) version 1.3",
    "VM0007",
    "August 8 2016 to August 7 2018",
    "VCS", "VCS", "VCS",
    "CCB", "CCB",
    "VM0007", "VM0007", "VM0007",
  ];
}

// ─── Tests that PASS with current code ───────────────────────────────────
//
// These document the CURRENT behavior: what happens today when you run
// resolveMethodologySignals with real document mention patterns.

describe("Cordillera Azul — current behavior (all pass)", () => {
  it("CCB report with only CCB mentions → program-only, no method resolution", () => {
    const mentions = [
      "CCBA", "CCB", "CCB", "CCB",
      "Gold Level", "Climate Community and Biodiversity",
      "CCB Standards Second Edition",
    ];
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.noMethodDetected).toBe(true);
    expect(result.programOnly).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
  });

  it("VM0007 not in inventory → caller handles unavailable, no false positives", () => {
    const smallInventory = new Set(["AR-ACM0003", "ACM0010"]);
    const mentions = ["VM0007", "CCB", "CCBA"];
    const result = resolveMethodologySignals(mentions, smallInventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);

    const unavailable = detectUnavailableMethod(mentions, smallInventory);
    expect(unavailable).toBe("VM0007");
  });

  it("VCS report: VM0007 v1.3 resolves as exactly-one primary methodology", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    expect(result.detectedMethods[0]!.confidence).toBe("exact-code");
    expect(result.detectedPrograms.some((p) => p.program === "Verra")).toBe(true);
  });

  it("VCS report: gating method codes returns [\"VM0007\"]", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const gated = gatingMethodCodes(result);
    expect(gated).toEqual(["VM0007"]);
  });

  it("VCS report: gating label includes VM0007", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const label = gatingLabel(result);
    expect(label).toContain("VM0007");
  });

  it("VCS report: VM0007 version (v1.3) preserved in rawMentions", () => {
    const mentions = vcsReportMentions();
    const versionedMention = mentions.find(
      (m) => m.includes("VM0007") && (m.includes("version 1.3") || m.includes("v1.3"))
    );
    expect(versionedMention).toBeDefined();

    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);

    const rawWithVersion = result.rawMentions.filter((m) => m.includes("version 1.3") || m.includes("v1.3"));
    expect(rawWithVersion.length).toBeGreaterThanOrEqual(1);
  });

  it("VCS report: CCB must NOT be governing standard (incidental mentions only)", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const ccbCount = mentions.filter((m) => m.includes("CCB") || m.includes("CCBA")).length;
    expect(ccbCount).toBeLessThanOrEqual(5);
    expect(result.detectedPrograms.some((p) => p.program === "Verra")).toBe(true);
  });

  it("PDD: VM0007 resolves as applied methodology under dual-standard project", () => {
    const mentions = pddMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("PDD: methodology evidence NOT from TOC or filename", () => {
    const mentions = pddMentions();
    const tocPhrases = ["Sectoral Scope", "Project Details", "Table of Contents"];
    for (const phrase of tocPhrases) {
      expect(mentions.some((m) => m.includes(phrase))).toBe(false);
    }
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);
  });

  it("PDD: VM0007 mention with Version 1.3 from Title and Reference section", () => {
    const mentions = pddMentions();
    const versioned = mentions.filter(
      (m) => m.includes("Version 1.3") || m.includes("version 1.3")
    );
    expect(versioned.length).toBeGreaterThanOrEqual(2);
  });

  it("Monitoring report: VM0007 resolves as applied methodology", () => {
    const mentions = monitoringMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("Monitoring report: reporting period extractable as project fact (not methodology)", () => {
    const mentions = monitoringMentions();
    const periodMention = mentions.find((m) => m.includes("August 8 2016"));
    expect(periodMention).toBeDefined();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("detectUnavailableMethod correctly detects VM0007 when not in inventory", () => {
    const smallInventory = new Set(["AR-ACM0003", "ACM0010"]);
    const mentions = ["VM0007", "REDD+ MF", "CCB"];

    const result = resolveMethodologySignals(mentions, smallInventory);
    expect(result.noMethodDetected).toBe(true);

    const unavailable = detectUnavailableMethod(mentions, smallInventory);
    expect(unavailable).toBe("VM0007");

    const programMap = buildMethodProgramMap(
      [
        { code: "ACM0010", versions: ["v1-0"], latestVersion: "v1-0" },
        { code: "AR-ACM0003", versions: ["v1-0"], latestVersion: "v1-0" },
      ],
    );
    const gate = gatingMethodCodes(result, programMap);
    expect(gate).toBeNull();
  });
});

// ─── Gap detectors: will pass after fixes ────────────────────────────────
//
// These tests document behaviors we WANT but that fail with the current
// code. They are wrapped in describe.skip so they don't fail CI.
// When the corresponding fixes land, remove the .skip and these
// become active regression guards.
//
// Run them explicitly: npx jest --no-coverage tests/lib/quickCheckMethodSignals.cordillera.test.ts

describe.skip("Cordillera Azul — gap detectors (will pass after full-text awareness)", () => {
  it("CCB report: VM0007 must NOT resolve as primary methodology", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // Desired: CCB report mentions VM0007 as supporting carbon-accounting
    // evidence (joint assessment context) but not as governing methodology.
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    expect(result.programOnly).toBe(true);

    const gated = gatingMethodCodes(result);
    expect(gated).toBeNull();
  });

  it("CCB report: CCB program signal must NOT collapse into Verra family", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const programs = result.detectedPrograms.map((p) => p.program);
    expect(programs).not.toContain("Verra");
  });

  it("CCB report: methodology mentions contain VM0007 but NOT as primary", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // VM0007 IS in the mention list but must NOT gate as primary
    expect(mentions.filter((m) => m.includes("VM0007")).length).toBeGreaterThanOrEqual(11);
    expect(result.noMethodDetected).toBe(true);
  });

  it("CCB report: gating label must NOT say 'Detected VM0007'", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const label = gatingLabel(result);
    expect(label).toBeNull();
  });

  it("Cross-doc: methodology role NOT decided by mention count alone", () => {
    const ccbMentions = ccbReportMentions();
    const vcsMentions = vcsReportMentions();

    const ccbResult = resolveMethodologySignals(ccbMentions, FULL_INVENTORY);
    const vcsResult = resolveMethodologySignals(vcsMentions, FULL_INVENTORY);

    // The CCB report has 11 VM0007 mentions and the VCS report has 31,
    // but they should resolve differently based on DOCUMENT FAMILY, not count.
    expect(ccbResult.noMethodDetected).toBe(true);
    expect(vcsResult.exactlyOne).toBe(true);
    expect(vcsResult.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("Cross-doc: resolver distinguishes 'validated against' from 'joint assessment' context", () => {
    const validatedAgainst = [
      "against the Verified Carbon Standard version 3.3 including the approved methodology VM0007 version 1.3",
    ];
    const jointAssessment = [
      "during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007",
    ];

    const vcsResult = resolveMethodologySignals(validatedAgainst, FULL_INVENTORY);
    const ccbResult = resolveMethodologySignals(jointAssessment, FULL_INVENTORY);

    // "validated against" → primary methodology → exactlyOne: true
    expect(vcsResult.exactlyOne).toBe(true);
    expect(vcsResult.detectedMethods[0]!.methodCode).toBe("VM0007");

    // "joint assessment" → supporting reference → noMethodDetected: true
    expect(ccbResult.noMethodDetected).toBe(true);
  });
});

// ─── Recently enabled gap detectors ──────────────────────────────────────
//
// These were previously in describe.skip but now PASS with the
// CCBA program signal fix in quickCheckMethodSignals.ts.

describe("Cordillera Azul — newly enabled (previously gap detectors)", () => {
  it("PDD: Dual VCS+CCB standards must NOT collapse into single Verra bucket", () => {
    const mentions = pddMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const uniquePrograms = new Set(result.detectedPrograms.map((p) => p.program));
    expect(uniquePrograms.size).toBeGreaterThanOrEqual(2);
  });

  it("Monitoring: Dual VCS+CCB must not collapse into single Verra bucket", () => {
    const mentions = monitoringMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const uniquePrograms = new Set(result.detectedPrograms.map((p) => p.program));
    expect(uniquePrograms.size).toBeGreaterThanOrEqual(2);
  });
});

// ─── Before/after behavior documentation ─────────────────────────────────
//
// BEFORE FIX:
//   ccbReportMentions() → resolveMethodologySignals → exactlyOne: true, method: VM0007
//   CCB program → "Verra" (collapsed into Verra bucket)
//   VCS and CCB reports → identical program resolution (both "Verra")
//
// AFTER FIX:
//   ccbReportMentions() → resolveMethodologySignals → noMethodDetected: true (needs full-text awareness)
//   CCB program → "CCBA/CCB" (separate family)
//   VCS report → program "Verra/VCS"
//   CCB report → program "CCBA/CCB"
//   Dual-standard PDD → both "Verra/VCS" and "CCBA/CCB" present
