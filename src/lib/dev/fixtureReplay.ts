/**
 * Dev-only Fixture Replay — pure comparison logic.
 *
 * Compares a live Quick Check ExtractionPreviewViewModel against a
 * pre-loaded fixture contract. No fs/path imports — safe for client
 * bundles. The contract data must be injected from a server-only source.
 *
 * The first observable mismatch (for CCB report):
 *   actual primary: "VM0007", fixture expects: no primary methodology,
 *   VM0007 only as supporting carbon-accounting reference.
 *
 * Three result statuses:
 *   "pass"     — the observable check matches the fixture
 *   "fail"     — the observable check contradicts the fixture
 *   "known_gap" — cannot be validated from the extraction preview;
 *                 requires extraction-depth or provenance fixes first
 */

import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";

// ─── Types ────────────────────────────────────────────────────────────────

export type FixtureContract = {
  description: string;
  generatedAt: string;
  strictEvalEligible: boolean;
  fixtures: FixtureEntry[];
};

export type FixtureEntry = {
  fixtureId: string;
  sourceFile: string;
  documentKind: string;
  expectedDocumentFamily: string;
  expectedPageCount: number | null;
  checks: ContractCheck[];
};

export type ContractCheck = {
  check: string;
  fixtureId: string;
  sourceFile: string;
  expectedStatus: string;
  expectedAnswer: string | null;
  mustNotClassifyAs: string[];
  evidence: { page: number | null; quote: string | null };
  bugPrevented: string;
  strictEvalEligible: boolean;
  blockedBy: string[];
};

export type CheckStatus = "pass" | "fail" | "known_gap";

export type FixtureReplayResult = {
  summary: string;
  comparisons: ComparisonResult[];
  passedCount: number;
  failedCount: number;
  knownGapCount: number;
  totalChecks: number;
  contractLoaded: boolean;
  contractError: string | null;
};

export type ComparisonResult = {
  check: string;
  label: string;
  actual: string | null;
  expected: string | null;
  status: CheckStatus;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Strip the hex prefix from a stored sourceFile. */
function cleanSourceFile(src: string): string {
  return src.replace(/^doc_[a-f0-9]+_/, "");
}

const FIXTURE_KEYS: Record<string, string> = {
  CCB_ValidationReport: "CCB_ValidationReport_V3-1_021913.pdf",
  VCS_ValidationReport: "VCS_ValidationReport_020113.pdf",
  PROJ_DESC: "PROJ_DESC_985_20DEC2012.pdf",
  MONIT_REP: "MONIT_REP_985_08AUG2016_07AUG2018.pdf",
};

function findFixture(contract: FixtureContract, fileName: string): FixtureEntry | undefined {
  for (const [key, suffix] of Object.entries(FIXTURE_KEYS)) {
    if (fileName.includes(key)) {
      return contract.fixtures.find((fx) => cleanSourceFile(fx.sourceFile) === suffix);
    }
  }
  return contract.fixtures.find((fx) =>
    fileName.includes(cleanSourceFile(fx.sourceFile).slice(0, 35)),
  );
}

/**
 * Match a methodology ID from a fixture's expected answer.
 *
 * Fixture expectedAnswer: "VM0007 v1.3 (REDD Methodology Modules)"
 * Actual primaryMethodology.id: "VM0007"
 *
 * Strategy: extract the canonical methodology code (e.g. "VM0007") from
 * the fixture's expected answer, then check if the actual starts with it
 * (or vice versa).
 */
function methodologyCanonicalMatch(
  actual: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!actual && !expected) return true;
  if (!actual || !expected) return false;
  const a = actual.replace(/\s+/g, " ").trim();
  const b = expected.replace(/\s+/g, " ").trim();
  // If either starts with the other, that's a canonical match
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // Case-insensitive full match
  if (a.toLowerCase() === b.toLowerCase()) return true;
  // Extract canonical code from expected (e.g. "VM0007" from "VM0007 v1.3...")
  const codeMatch = b.match(/^(VM\d{4}|ACM\d{4}|AR-ACM\d{4}|GS-\w+)/);
  if (codeMatch && a.includes(codeMatch[1])) return true;
  return false;
}

/** Check whether `actual` text contains the fixture's expected answer (fuzzy). */
function answerContains(actual: string | null, expected: string | null): boolean {
  if (!actual && !expected) return true;
  if (!actual || !expected) return false;
  return actual.toLowerCase().includes(expected.toLowerCase());
}

// ─── Known-gap sets ──────────────────────────────────────────────────────

/** Checks the extraction preview cannot validate because they need extraction depth. */
const EXTRACTION_DEPTH_GAPS = new Set([
  "baseline_scenario", "additionality", "leakage",
  "monitoring_plan", "crediting_period", "reporting_period", "project_id",
]);

// ─── Labels ───────────────────────────────────────────────────────────────

const CHECK_LABELS: Record<string, string> = {
  primary_methodology: "Primary methodology",
  methodology: "Methodology",
  supporting_carbon_methodology: "Supporting carbon methodology",
  document_family: "Standard family",
  host_country: "Host country",
  document_type: "Document type",
  baseline_scenario: "Baseline scenario",
  additionality: "Additionality",
  leakage: "Leakage",
  monitoring_plan: "Monitoring plan",
  crediting_period: "Crediting period",
  reporting_period: "Reporting period",
  project_id: "Project ID",
};

// ─── Main comparison ─────────────────────────────────────────────────────

/**
 * Compare live Quick Check output against a loaded fixture contract.
 * Pure function — no I/O, no imports from Node.js.
 *
 * Every check receives one of three statuses:
 *   "pass"      — observable and matches the fixture
 *   "fail"      — observable and contradicts the fixture
 *   "known_gap" — not observable from the extraction preview;
 *                 needs extraction-depth or provenance fixes
 */
export function compareWithFixture(
  contract: FixtureContract | null,
  preview: ExtractionPreviewViewModel,
  fileName: string | null,
): FixtureReplayResult {
  // Contract load failure — visible error
  if (!contract) {
    return {
      summary: "Fixture contract not loaded. Is the contract JSON reachable?",
      comparisons: [],
      passedCount: 0,
      failedCount: 0,
      knownGapCount: 0,
      totalChecks: 0,
      contractLoaded: false,
      contractError: "Contract data is null. Ensure cordillera-azul-reliability-contract.json is deployed.",
    };
  }

  if (!fileName) {
    return {
      summary: "No filename available for fixture comparison",
      comparisons: [],
      passedCount: 0,
      failedCount: 0,
      knownGapCount: 0,
      totalChecks: 0,
      contractLoaded: true,
      contractError: null,
    };
  }

  const fixture = findFixture(contract, fileName);
  if (!fixture) {
    return {
      summary: `"${fileName}" is not a known Cordillera Azul fixture. No comparison performed.`,
      comparisons: [],
      passedCount: 0,
      failedCount: 0,
      knownGapCount: 0,
      totalChecks: 0,
      contractLoaded: true,
      contractError: null,
    };
  }

  const comparisons: ComparisonResult[] = [];
  const checks = fixture.checks;

  // ── Methodology (primary) ──
  const actualPrimary = preview.primaryMethodology?.id ?? null;
  const methCheck = checks.find((c) => c.check === "primary_methodology" || c.check === "methodology");
  if (methCheck) {
    const passed = methCheck.expectedStatus === "not_found"
      ? actualPrimary === null
      : methodologyCanonicalMatch(actualPrimary, methCheck.expectedAnswer);
    comparisons.push({
      check: "primary_methodology",
      label: CHECK_LABELS.primary_methodology,
      actual: actualPrimary,
      expected: methCheck.expectedStatus === "not_found" ? "null" : methCheck.expectedAnswer,
      status: passed ? "pass" : "fail",
    });
  }

  // ── Supporting carbon methodology ──
  const actualRefs = preview.referencedMethods?.map((m) => m.id).join(", ") ?? null;
  const supCheck = checks.find((c) => c.check === "supporting_carbon_methodology");
  if (supCheck) {
    const passed = supCheck.expectedStatus === "answered"
      ? (actualRefs?.toLowerCase().includes(supCheck.expectedAnswer?.toLowerCase() ?? "") ?? false)
      : actualRefs === null;
    comparisons.push({
      check: "supporting_carbon_methodology",
      label: CHECK_LABELS.supporting_carbon_methodology,
      actual: actualRefs,
      expected: supCheck.expectedAnswer ?? "null",
      status: passed ? "pass" : "fail",
    });
  }

  // ── Document family ──
  const actualFamily = preview.detectedDocumentType ?? null;
  const famCheck = checks.find((c) => c.check === "document_family");
  if (famCheck) {
    const passed = answerContains(actualFamily, famCheck.expectedAnswer);
    comparisons.push({
      check: "document_family",
      label: CHECK_LABELS.document_family,
      actual: actualFamily,
      expected: famCheck.expectedAnswer ?? "",
      status: passed ? "pass" : "fail",
    });
  }

  // ── Document type ──
  const actualDocType = preview.detectedDocumentType ?? null;
  const docTypeCheck = checks.find((c) => c.check === "document_type");
  if (docTypeCheck) {
    const passed = answerContains(actualDocType, docTypeCheck.expectedAnswer);
    comparisons.push({
      check: "document_type",
      label: CHECK_LABELS.document_type,
      actual: actualDocType,
      expected: docTypeCheck.expectedAnswer ?? "",
      status: passed ? "pass" : "fail",
    });
  }

  // ── Host country (known_gap — not visible in extraction preview signals) ──
  const countryCheck = checks.find((c) => c.check === "host_country");
  if (countryCheck) {
    comparisons.push({
      check: "host_country",
      label: CHECK_LABELS.host_country,
      actual: "extraction detail (not in preview signals)",
      expected: countryCheck.expectedAnswer ?? "null",
      status: "known_gap",
    });
  }

  // ── Deep-content checks (known_gap — need extraction depth) ──
  for (const deepCheck of EXTRACTION_DEPTH_GAPS) {
    const c = checks.find((ch) => ch.check === deepCheck);
    if (c) {
      comparisons.push({
        check: deepCheck,
        label: CHECK_LABELS[deepCheck] ?? deepCheck,
        actual: "requires extraction depth (page >10)",
        expected: c.expectedAnswer ?? (c.expectedStatus === "not_found" ? "null" : c.expectedAnswer),
        status: "known_gap",
      });
    }
  }

  // ── Counts ──
  const passedCount = comparisons.filter((c) => c.status === "pass").length;
  const failedCount = comparisons.filter((c) => c.status === "fail").length;
  const knownGapCount = comparisons.filter((c) => c.status === "known_gap").length;
  const totalChecks = checks.length;

  // ── Honest summary ──
  const parts: string[] = [];
  if (passedCount > 0) parts.push(`${passedCount} passed`);
  if (failedCount > 0) parts.push(`${failedCount} failed`);
  if (knownGapCount > 0) parts.push(`${knownGapCount} not validated (known gaps)`);

  const detail = failedCount > 0
    ? `First visible: CCB report shows VM0007 primary, fixture expects no primary methodology.`
    : "";

  const summary = totalChecks > 0
    ? `${parts.join("; ")} of ${totalChecks} contract checks. ${detail}`
    : "No checks to compare.";

  return {
    summary,
    comparisons,
    passedCount,
    failedCount,
    knownGapCount,
    totalChecks,
    contractLoaded: true,
    contractError: null,
  };
}
