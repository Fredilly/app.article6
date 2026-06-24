/**
 * Cordillera Azul reliability fixture tests.
 *
 * These tests encode the exact signal resolution contracts for the
 * Cordillera Azul National Park REDD project document family.
 *
 * KEY BEHAVIOR RULES:
 *   1. CCB report: VM0007 is incidental_mention, not primary.
 *   2. VCS report: VM0007 v1.3 is primary_applied methodology.
 *   3. PDD: VM0007 is applied_in_project under dual VCS+CCB standards.
 *   4. Monitoring report: VM0007 is applied_in_project; blocked by payload limit.
 *   5. CCB/CCBA is NOT a Verra-equivalent program family.
 *   6. Methodology role is NOT decided by mention count alone.
 *   7. Any answered result must have page and quote provenance.
 *
 * Do not add to strict eval until parser extraction depth and page
 * provenance can support the expected gold answers.
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
//
// These simulate the REAL mention patterns extracted from each PDF,
// including the surrounding context that distinguishes incidental mentions
// from governing methodology references.

/** CCB report mentions: 11 VM0007 occurrences, always in joint-assessment context */
function ccbReportMentions(): string[] {
  return [
    // Executive Summary (page 1) — NO VM0007 here. Just CCBA standard.
    "CCBA", "CCB",
    // Scope and Criteria (page 1) — CCB Standards Second Edition
    "Climate Community and Biodiversity Project Design Standards Second Edition",
    "CCB Standards",
    // Section 2.0 Methodology (page 4) — THE ONLY VM0007 context in the document
    "during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007",
    "VM0007",
    // Auditor qualifications (pages 5-10) — incidental background
    "VCS AFOLU expert",
    "Climate Community and Biodiversity Standards",
    "Verified Carbon Standard",
    // Appendix — carbon quantification reference
    "VCS VM0007 methodology",
    // Gold Level Section (pages 33-36) — NO VM0007
    "Gold Level", "GL1", "GL2", "GL3",
    // Conclusion (page 37) — CCB Validation Conclusion, no VM0007
    "CCB Validation Conclusion",
    // Remaining VM0007 mentions within other sections
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007",
  ];
}

/** VCS report mentions: 31 VM0007 occurrences, always as governing methodology */
function vcsReportMentions(): string[] {
  return [
    // Cover page (page 1) — VCS Version 3
    "VALIDATION REPORT VCS Version 3",
    "VCS",
    // Summary (page 2) — THE KEY CONTEXT
    "against the Verified Carbon Standard version 3.3 and its supporting documents including the approved methodology VM0007 version 1.3 REDD Methodology Modules",
    "VM0007", "Verified Carbon Standard",
    "REDD Methodology Modules",
    // Conclusion (page 2) — confirms conformance
    "correctly applies the selected methodology element and is in conformance with all applicable requirements of the Verified Carbon Standard (VCS)",
    "VCS",
    // Detailed Requirements section
    "approved methodology VM0007 and that they are indeed planned and appropriate",
    "VM0007", "VCS",
    // Methodology references throughout
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007",
    "VCS", "VCS", "VCS", "VCS", "VCS",
  ];
}

/** PDD mentions: VM0007 as applied methodology, dual VCS+CCB standards */
function pddMentions(): string[] {
  return [
    // Section 1 — dual standards named (line 415)
    "Two protocols were identified to develop and monitor the project: Verified Carbon Standard (VCS) and the Community Climate and Biodiversity (CCB) protocol",
    "Under VCS the project is using VM0007 REDD Methodology Modules (REDD-MF)",
    "VM0007", "VCS", "CCB",
    // Title and Reference of Methodology (Section 2.1, line 3102)
    "the modular REDD methodology VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012",
    "VM0007 REDD Methodology Module REDD Methodology Framework (REDD-MF) version 1.3",
    "VM0007", "VCS",
    "CCB Standards Second Edition",
    // Throughout document
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007", "VM0007", "VM0007",
    "VM0007", "VM0007",
    "VCS", "VCS",
    "CCB", "CCB", "CCBA",
  ];
}

/** Monitoring report mentions: VM0007 as applied methodology */
function monitoringMentions(): string[] {
  return [
    "MONITORING REPORT CCB Version 2 VCS Version 3",
    "VCS", "CCB",
    "Cordillera Azul National Park REDD+ Project",
    // Methodology section
    "VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012",
    "VM0007 REDD Methodology Module REDD Methodology Framework (REDD-MF) version 1.3",
    "VM0007",
    // Reporting period
    "August 8 2016 to August 7 2018",
    "VCS", "VCS", "VCS",
    "CCB", "CCB",
    "VM0007", "VM0007", "VM0007",
  ];
}

// ─── Fixture 1: CCB Validation Report ─────────────────────────────────────
//
// Document Family: CCBA/CCB
// VM0007 role: incidental_mention only
// CCB must NOT collapse into Verra program family

describe("Cordillera Azul CCB Validation Report — document family: CCBA/CCB", () => {
  it("VM0007 must NOT resolve as primary methodology when mentioned only in joint-assessment context", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // This assertion would FAIL before a fix: the resolver currently
    // treats any VM0007 mention as primary, regardless of context.
    //
    // Desired behavior: VM0007 should NOT be detected as primary
    // because every occurrence is within "joint assessment under VCS"
    // or "auditor qualifications" context — NOT governing methodology.
    //
    // The resolver must distinguish:
    //   - "validated against [methodology]" → primary_applied
    //   - "during a joint assessment... and [methodology]" → incidental_mention
    //
    // Root cause: resolveMethodologySignals in quickCheckMethodSignals.ts
    // does not accept documentFamily context. Without it, every VM0007
    // occurrence gates identically regardless of governing standard.
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);
    expect(result.programOnly).toBe(true);

    // gatingMethodCodes must NOT return ["VM0007"]
    const gated = gatingMethodCodes(result);
    expect(gated).toBeNull();
  });

  it("CCB program signal must NOT collapse into Verra family", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // CCB is currently mapped to program "Verra" in PROGRAM_SIGNALS
    // (line 125 of quickCheckMethodSignals.ts). This is incorrect —
    // CCBA is a separate standard family.
    //
    // Until PROGRAM_SIGNALS is fixed, this assertion documents the gap.
    const programs = result.detectedPrograms.map((p) => p.program);
    // CCB alone should produce a distinct program, not "Verra"
    expect(programs).not.toContain("Verra");
  });

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

  it("CCB report methodology mentions set should contain VM0007 as a mention", () => {
    // VM0007 should still appear in methodologyMentions (the extraction
    // should note it was mentioned). But it must NOT gate as primary.
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // VM0007 IS in the mention list — that's fine. The bug is that it
    // triggers primary resolution. We want NO primary method detected.
    expect(mentions.filter((m) => m.includes("VM0007")).length).toBeGreaterThanOrEqual(11);
    expect(result.noMethodDetected).toBe(true);
  });

  it("gating label must NOT say 'Detected VM0007' for CCB report", () => {
    const mentions = ccbReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const label = gatingLabel(result);

    // If the resolver returns null (no method), gatingLabel returns null
    // If the resolver incorrectly resolves VM0007, gatingLabel says "Detected VM0007"
    // This assertion guards against the incorrect behavior.
    expect(label).toBeNull();
  });

  it("VM0007 not in inventory → caller handles unavailable, no false positives", () => {
    const smallInventory = new Set(["AR-ACM0003", "ACM0010"]);
    const mentions = ["VM0007", "CCB", "CCBA"];
    const result = resolveMethodologySignals(mentions, smallInventory);
    expect(result.noMethodDetected).toBe(true);
    expect(result.detectedMethods).toHaveLength(0);

    // Caller should detect VM0007 as unavailable
    const unavailable = detectUnavailableMethod(mentions, smallInventory);
    expect(unavailable).toBe("VM0007");
  });
});

// ─── Fixture 2: VCS Validation Report ────────────────────────────────────
//
// Document Family: VCS
// VM0007 v1.3 role: primary_applied
// Evidence must come from Summary/Objective sections, not generic header/TOC

describe("Cordillera Azul VCS Validation Report — document family: VCS", () => {
  it("VM0007 v1.3 must resolve as exactly-one primary methodology (governing methodology)", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // VCS report validates AGAINST VCS v3.3, and VM0007 is the
    // approved methodology. It MUST resolve as primary.
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
    expect(result.detectedMethods[0]!.confidence).toBe("exact-code");
    expect(result.detectedPrograms.some((p) => p.program === "Verra")).toBe(true);
  });

  it("gating method codes returns [\"VM0007\"] for VCS report", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const gated = gatingMethodCodes(result);
    expect(gated).toEqual(["VM0007"]);
  });

  it("gating label must include VM0007 for VCS report", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    const label = gatingLabel(result);
    expect(label).toContain("VM0007");
  });

  it("VM0007 version (v1.3) must be preserved in methodology answer provenance", () => {
    const mentions = vcsReportMentions();

    // The version appears in the Summary paragraph quote:
    // "the approved methodology VM0007 version 1.3, REDD Methodology Modules"
    const versionedMention = mentions.find(
      (m) => m.includes("VM0007") && (m.includes("version 1.3") || m.includes("v1.3"))
    );
    // This assertion just checks the fixture data is correct
    expect(versionedMention).toBeDefined();

    // Future: once resolver supports version preservation, assert:
    // result.detectedMethods[0].version === "v1.3"
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);

    // Current limitation: resolver normalizes to "VM0007", dropping version
    // The rawMentions preserve the original text
    const rawWithVersion = result.rawMentions.filter((m) => m.includes("version 1.3") || m.includes("v1.3"));
    expect(rawWithVersion.length).toBeGreaterThanOrEqual(1);
  });

  it("CCB must NOT be governing standard for VCS report (even if mentioned)", () => {
    const mentions = vcsReportMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // VCS report has 5 incidental CCB mentions. They must not override
    // the VCS document family.
    const ccbCount = mentions.filter((m) => m.includes("CCB") || m.includes("CCBA")).length;
    expect(ccbCount).toBeLessThanOrEqual(5); // Incidental
    expect(result.detectedPrograms.some((p) => p.program === "Verra")).toBe(true);
  });
});

// ─── Fixture 3: PDD ──────────────────────────────────────────────────────
//
// Document Family: project_description (dual VCS+CCB)
// VM0007 role: applied_in_project
// Dual standard signals must be preserved

describe("Cordillera Azul PDD — document family: project_description, dual VCS+CCB", () => {
  it("VM0007 must resolve as applied methodology under dual-standard project", () => {
    const mentions = pddMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // PDD explicitly states: "Under VCS, the project is using VM0007"
    // VM0007 IS the applied methodology, but in project_description context
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("Dual VCS+CCB standards must NOT collapse into single Verra program bucket", () => {
    const mentions = pddMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // Current behavior: CCB maps to Verra via PROGRAM_SIGNALS.
    // Both VCS and CCB mentions produce program "Verra" — collapsing
    // the dual-standard identity into a single bucket.
    //
    // Desired: VCS → "Verra/VCS", CCB → "CCBA/CCB"
    // This test documents the gap.
    const programs = result.detectedPrograms.map((p) => `${p.program}:${p.sourceMention}`).sort();
    const uniquePrograms = new Set(result.detectedPrograms.map((p) => p.program));

    expect(uniquePrograms.size).toBeGreaterThanOrEqual(2);
  });

  it("PDD methodology evidence must NOT come from TOC or filename", () => {
    const mentions = pddMentions();

    // No TOC-level text in the mentions
    const tocPhrases = ["Sectoral Scope", "Project Details", "Table of Contents"];
    for (const phrase of tocPhrases) {
      expect(mentions.some((m) => m.includes(phrase))).toBe(false);
    }

    // All mentions come from body content (Section 1 and Section 2.1)
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.exactlyOne).toBe(true);
  });

  it("VM0007 methodology mention with version: Version 1.3 from Title and Reference section", () => {
    const mentions = pddMentions();
    const versioned = mentions.filter(
      (m) => m.includes("Version 1.3") || m.includes("version 1.3")
    );
    expect(versioned.length).toBeGreaterThanOrEqual(2); // Section 2.1 + REDD-MF
  });
});

// ─── Fixture 4: Monitoring Report ────────────────────────────────────────
//
// Document Family: project_monitoring (dual VCS+CCB)
// VM0007 role: applied_in_project
// Blocked by parser_payload_limit (9MB PDF → 413 error)

describe("Cordillera Azul Monitoring Report — document family: project_monitoring", () => {
  it("VM0007 must resolve as applied methodology from monitoring context", () => {
    const mentions = monitoringMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    // The monitoring report header and methodology section both cite VM0007
    expect(result.exactlyOne).toBe(true);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });

  it("Dual VCS+CCB monitoring report must not collapse into single Verra bucket", () => {
    const mentions = monitoringMentions();
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);

    const uniquePrograms = new Set(result.detectedPrograms.map((p) => p.program));
    expect(uniquePrograms.size).toBeGreaterThanOrEqual(2);
  });

  it("Monitoring report reporting period should be extractable as project fact", () => {
    const mentions = monitoringMentions();

    // Check fixture data has the reporting period
    const periodMention = mentions.find((m) => m.includes("August 8 2016"));
    expect(periodMention).toBeDefined();

    // The reporting period is NOT a methodology signal — it's a project fact.
    // resolveMethodologySignals should ignore date ranges.
    const result = resolveMethodologySignals(mentions, FULL_INVENTORY);
    expect(result.detectedMethods[0]!.methodCode).toBe("VM0007");
  });
});

// ─── Cross-document regression guards ─────────────────────────────────────

describe("Cross-document methodology disambiguation", () => {
  it("Methodology role must NOT be decided by mention count alone", () => {
    // CCB report has 11 VM0007 mentions — but they're all incidental.
    // VCS report has 31 VM0007 mentions — because it's the governing methodology.
    //
    // The distinction is CONTEXT, not count.
    //   CCB: "joint assessment under... VM0007" (incidental)
    //   VCS: "approved methodology VM0007 version 1.3" (governing)
    const ccbMentions = ccbReportMentions();
    const vcsMentions = vcsReportMentions();

    const ccbResult = resolveMethodologySignals(ccbMentions, FULL_INVENTORY);
    const vcsResult = resolveMethodologySignals(vcsMentions, FULL_INVENTORY);

    // Currently BOTH resolve to VM0007 as primary — this is the bug.
    // Desired: CCB → noMethodDetected, VCS → exactlyOne === VM0007
    expect(ccbResult.noMethodDetected).toBe(true);
    expect(vcsResult.exactlyOne).toBe(true);
    expect(vcsResult.detectedMethods[0]!.methodCode).toBe("VM0007");

    const ccbCount = ccbMentions.filter((m) => m.includes("VM0007")).length;
    const vcsCount = vcsMentions.filter((m) => m.includes("VM0007")).length;

    // Count alone is irrelevant — context determines role
    console.log("GAP: CCB mentions", ccbCount, "→", ccbResult.detectedMethods.length, "methods");
    console.log("GAP: VCS mentions", vcsCount, "→", vcsResult.detectedMethods.length, "methods");
  });

  it("Resolver must distinguish 'validated against' from 'joint assessment' context", () => {
    // These two strings have the same methodology code (VM0007) but
    // completely different roles:
    const validatedAgainst = [
      "against the Verified Carbon Standard version 3.3 including the approved methodology VM0007 version 1.3",
    ];
    const jointAssessment = [
      "during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007",
    ];

    const vcsResult = resolveMethodologySignals(validatedAgainst, FULL_INVENTORY);
    const ccbResult = resolveMethodologySignals(jointAssessment, FULL_INVENTORY);

    // With documentFamily context, these would produce different results.
    // For now, both resolve identically.
    expect(vcsResult.exactlyOne).toBe(true);
    expect(vcsResult.detectedMethods[0]!.methodCode).toBe("VM0007");

    // ✓ Desired: ccbResult should NOT detect VM0007 as primary
    //   Root cause: resolveMethodologySignals doesn't examine surrounding context words
    //   (e.g., "validated against" vs "during a joint assessment under")
    expect(ccbResult.noMethodDetected).toBe(true);
  });

  it("detectUnavailableMethod correctly detects VM0007 when not in inventory", () => {
    const smallInventory = new Set(["AR-ACM0003", "ACM0010"]);
    const mentions = ["VM0007", "REDD+ MF", "CCB"];

    const result = resolveMethodologySignals(mentions, smallInventory);
    expect(result.noMethodDetected).toBe(true);

    const unavailable = detectUnavailableMethod(mentions, smallInventory);
    expect(unavailable).toBe("VM0007");

    // Caller should record "VM0007" as an unavailable method and
    // NOT fall back to broad UNFCCC candidates
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

// ─── Before/after behavior documentation ─────────────────────────────────
//
// These comments document exactly which assertions would change behavior
// once the fixes are in place.
//
// BEFORE FIX:
//   ccbReportMentions() → resolveMethodologySignals → exactlyOne: true, method: VM0007
//   CCB program → "Verra" (collapsed into Verra bucket)
//   VCS and CCB reports → identical program resolution (both "Verra")
//
// AFTER FIX:
//   ccbReportMentions() → resolveMethodologySignals → noMethodDetected: true
//   CCB program → "CCBA/CCB" (separate family)
//   VCS report → program "Verra/VCS"
//   CCB report → program "CCBA/CCB"
//   Dual-standard PDD → both "Verra/VCS" and "CCBA/CCB" present
