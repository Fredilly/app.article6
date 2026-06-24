/**
 * Dev-only Fixture Replay — compares live Quick Check output against
 * the Cordillera Azul reliability fixture contract.
 *
 * Gated behind NODE_ENV !== "production".
 *
 * The first visible mismatch:
 *   CCB report currently shows VM0007 primary, but fixture expects
 *   no primary methodology and VM0007 only as supporting reference.
 */

import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";
import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────

export type FixtureReplayResult = {
  summary: string;
  comparisons: ComparisonResult[];
  mismatchCount: number;
};

export type ComparisonResult = {
  check: string;
  actual: string | null;
  expected: string | null;
  passed: boolean;
};

type ContractCheck = {
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

type ContractFixture = {
  fixtureId: string;
  sourceFile: string;
  checks: ContractCheck[];
};

type ContractData = { fixtures: ContractFixture[] };

// ─── Lazy-loaded contract ────────────────────────────────────────────────

const CONTRACT_PATH = "tests/fixtures/quick-check/cordillera-azul-reliability-contract.json";

let _contract: ContractData | null | undefined = undefined;

function loadContract(): ContractData | null {
  if (_contract !== undefined) return _contract;
  try {
    const resolved = path.resolve(CONTRACT_PATH);
    _contract = JSON.parse(fs.readFileSync(resolved, "utf-8")) as ContractData;
    return _contract;
  } catch {
    _contract = null;
    return null;
  }
}

/**
 * Strip the hex prefix from a stored sourceFile so it matches user-visible names.
 * Input:  "doc_0bd5d5d439f5_CCB_ValidationReport_V3-1_021913.pdf"
 * Output: "CCB_ValidationReport_V3-1_021913.pdf"
 */
function cleanSourceFile(sourceFile: string): string {
  return sourceFile.replace(/^doc_[a-f0-9]+_/, "");
}

// ─── Matching ─────────────────────────────────────────────────────────────

/** Known document-key → sourceFile suffix for fast matching. */
const FIXTURE_KEYS: Record<string, string> = {
  CCB_ValidationReport: "CCB_ValidationReport_V3-1_021913.pdf",
  VCS_ValidationReport: "VCS_ValidationReport_020113.pdf",
  PROJ_DESC: "PROJ_DESC_985_20DEC2012.pdf",
  MONIT_REP: "MONIT_REP_985_08AUG2016_07AUG2018.pdf",
};

function findFixture(fileName: string): ContractFixture | undefined {
  const contract = loadContract();
  if (!contract) return undefined;

  // Quick lookup by document key
  for (const [key, suffix] of Object.entries(FIXTURE_KEYS)) {
    if (fileName.includes(key)) {
      return contract.fixtures.find((fx) => cleanSourceFile(fx.sourceFile) === suffix);
    }
  }

  // Fallback: try matching clean filename against each fixture
  return contract.fixtures.find((fx) => fileName.includes(cleanSourceFile(fx.sourceFile).slice(0, 35)));
}

// ─── Comparison ───────────────────────────────────────────────────────────

/**
 * Compare actual Quick Check output against the fixture contract.
 *
 * Returns null if the uploaded file isn't a known Cordillera fixture.
 */
export function compareWithFixture(
  preview: ExtractionPreviewViewModel,
  fileName: string | null,
): FixtureReplayResult | null {
  if (!fileName) return null;

  const fixture = findFixture(fileName);
  if (!fixture) return null;

  const comparisons: ComparisonResult[] = [];
  const checks = fixture.checks;

  // Primary methodology — handle both "primary_methodology" (CCB) and "methodology" (VCS/PDD/Monitoring)
  const actualPrimary = preview.primaryMethodology?.id ?? null;
  const primaryCheck = checks.find((c) => c.check === "primary_methodology" || c.check === "methodology");
  if (primaryCheck) {
    const passed = primaryCheck.expectedStatus === "not_found"
      ? actualPrimary === null
      : actualPrimary === primaryCheck.expectedAnswer;
    comparisons.push({
      check: "primary_methodology",
      actual: actualPrimary,
      expected: primaryCheck.expectedStatus === "not_found" ? "null" : primaryCheck.expectedAnswer,
      passed,
    });
  }

  // Supporting carbon methodology
  const actualRefs = preview.referencedMethods?.map((m) => m.id).join(", ") ?? null;
  const supportingCheck = checks.find((c) => c.check === "supporting_carbon_methodology");
  if (supportingCheck) {
    const passed = supportingCheck.expectedStatus === "answered"
      ? (actualRefs?.includes(supportingCheck.expectedAnswer ?? "") ?? false)
      : actualRefs === null;
    comparisons.push({
      check: "supporting_carbon_methodology",
      actual: actualRefs,
      expected: supportingCheck.expectedAnswer ?? "null",
      passed,
    });
  }

  // Document family
  const actualFamily = preview.detectedDocumentType ?? null;
  const familyCheck = checks.find((c) => c.check === "document_family");
  if (familyCheck) {
    const passed = actualFamily?.toLowerCase().includes(familyCheck.expectedAnswer?.toLowerCase() ?? "") ?? false;
    comparisons.push({
      check: "document_family",
      actual: actualFamily,
      expected: familyCheck.expectedAnswer ?? "",
      passed,
    });
  }

  const mismatchCount = comparisons.filter((c) => !c.passed).length;
  const summary = mismatchCount > 0
    ? `Fixture replay: ${mismatchCount} mismatch(es) detected. ${comparisons.filter((c) => !c.passed).map((c) => c.check).join(", ")}`
    : "Fixture replay: all checks pass";

  return { summary, comparisons, mismatchCount };
}
