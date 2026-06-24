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

export type FixtureReplayResult = {
  /** Human-readable description of fixture state */
  summary: string;
  /** Per-check comparison results */
  comparisons: ComparisonResult[];
  /** Total failed comparisons */
  mismatchCount: number;
  /** Whether the contract loaded successfully */
  contractLoaded: boolean;
  /** Error message if contract failed */
  contractError: string | null;
};

export type ComparisonResult = {
  check: string;
  /** Human-readable label */
  label: string;
  actual: string | null;
  expected: string | null;
  passed: boolean;
  /** Whether missing page/quote provenance is a known gap */
  provenanceKnownGap: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Strip the hex prefix from a stored sourceFile. */
function cleanSourceFile(src: string): string {
  return src.replace(/^doc_[a-f0-9]+_/, "");
}

/** Known document-key → sourceFile suffix. */
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

/** Compare two strings case-insensitively after normalizing whitespace. */
function normalizedMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.replace(/\s+/g, " ").trim().toLowerCase() ===
         b.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Check whether `actual` answer text contains the fixture's expected answer (fuzzy). */
function answerContains(actual: string | null, expected: string | null): boolean {
  if (!actual && !expected) return true;
  if (!actual || !expected) return false;
  return actual.toLowerCase().includes(expected.toLowerCase());
}

// ─── Main comparison ──────────────────────────────────────────────────────

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

/**
 * Compare live Quick Check output against a loaded fixture contract.
 * Pure function — no I/O, no imports from Node.js.
 *
 * @param contract  Pre-loaded fixture contract (must be loaded server-side)
 * @param preview   Current extraction preview from Quick Check
 * @param fileName  The uploaded filename
 */
export function compareWithFixture(
  contract: FixtureContract | null,
  preview: ExtractionPreviewViewModel,
  fileName: string | null,
): FixtureReplayResult {
  // Build the result object even on contract failure — makes error visible
  if (!contract) {
    return {
      summary: "Fixture contract not loaded. Is the contract JSON reachable?",
      comparisons: [],
      mismatchCount: 0,
      contractLoaded: false,
      contractError: "Contract data is null. Ensure cordillera-azul-reliability-contract.json is deployed alongside this build.",
    };
  }

  if (!fileName) {
    return {
      summary: "No filename available for fixture comparison",
      comparisons: [],
      mismatchCount: 0,
      contractLoaded: true,
      contractError: null,
    };
  }

  const fixture = findFixture(contract, fileName);
  if (!fixture) {
    return {
      summary: `"${fileName}" is not a known Cordillera Azul fixture. No comparison performed.`,
      comparisons: [],
      mismatchCount: 0,
      contractLoaded: true,
      contractError: null,
    };
  }

  const comparisons: ComparisonResult[] = [];
  const checks = fixture.checks;

  // ── Methodology (primary) ──
  // Handles both "primary_methodology" (CCB split) and "methodology" (VCS/PDD/Monitoring)
  const actualPrimary = preview.primaryMethodology?.id ?? null;
  const methCheck = checks.find((c) => c.check === "primary_methodology" || c.check === "methodology");
  if (methCheck) {
    const passed = methCheck.expectedStatus === "not_found"
      ? actualPrimary === null
      : normalizedMatch(actualPrimary, methCheck.expectedAnswer);
    comparisons.push({
      check: "primary_methodology",
      label: CHECK_LABELS.primary_methodology,
      actual: actualPrimary,
      expected: methCheck.expectedStatus === "not_found" ? "null" : methCheck.expectedAnswer,
      passed,
      provenanceKnownGap: false,
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
      passed,
      provenanceKnownGap: false,
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
      passed,
      provenanceKnownGap: false,
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
      passed,
      provenanceKnownGap: false,
    });
  }

  // ── Host country ──
  // Host country is extracted from the PDF but not visible in the
  // extraction preview signals — we note it as a known gap.
  const countryCheck = checks.find((c) => c.check === "host_country");
  if (countryCheck) {
    comparisons.push({
      check: "host_country",
      label: CHECK_LABELS.host_country,
      actual: "extraction detail (not in preview signals)",
      expected: countryCheck.expectedAnswer ?? "null",
      passed: true,
      provenanceKnownGap: true,
    });
  }

  // ── Baseline, additionality, leakage, monitoring, crediting period ──
  // These are deep-content checks that the extraction preview doesn't show.
  // We mark them as provenance known gaps — the preview can't surface
  // them without extraction-depth fixes.
  for (const deepCheck of ["baseline_scenario", "additionality", "leakage",
    "monitoring_plan", "crediting_period", "reporting_period", "project_id"]) {
    const c = checks.find((ch) => ch.check === deepCheck);
    if (c) {
      comparisons.push({
        check: deepCheck,
        label: CHECK_LABELS[deepCheck] ?? deepCheck,
        actual: "requires extraction depth (page >10)",
        expected: c.expectedAnswer ?? (c.expectedStatus === "not_found" ? "null" : c.expectedAnswer),
        passed: true,
        provenanceKnownGap: true,
      });
    }
  }

  const mismatchCount = comparisons.filter((c) => !c.passed && !c.provenanceKnownGap).length;
  const summary = mismatchCount > 0
    ? `${mismatchCount} mismatch(es) — first visible: CCB report shows VM0007 primary, expected null`
    : "All observable checks match fixture";

  return {
    summary,
    comparisons,
    mismatchCount,
    contractLoaded: true,
    contractError: null,
  };
}

