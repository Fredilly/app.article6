/**
 * QUICK CHECK SECTION MATCHING DIAGNOSTIC SCRIPT
 *
 * Purpose:
 *   Given raw extracted PDD text + a user question, print the COMPLETE matching
 *   path and decision points so we can classify false negatives as:
 *     - section never detected by extractPddSections
 *     - title corrupted / polluted
 *     - headingScore too low (PRIMARY_HEADING_THRESHOLD = 5)
 *     - candidate rejected by hasBodyTextAfter / TOC / etc.
 *     - claim keyword extraction too aggressive
 *     - reviewArea classification sent us down the wrong keyword set
 *
 * DO NOT CHANGE MATCHING LOGIC WHILE DEBUGGING.
 * Only add more print statements here if needed.
 *
 * HOW TO RUN
 * ----------
 *   # Run everything in this file (recommended)
 *   npx jest tests/diagnostics/quick-check-matching.diagnostic.test.ts --silent=false
 *
 *   # Focus on one specific question
 *   npx jest tests/diagnostics/quick-check-matching.diagnostic.test.ts -t "DIAG: stakeholder" --silent=false
 *
 *   # Focus on the 2.2 case
 *   npx jest tests/diagnostics/quick-check-matching.diagnostic.test.ts -t "DIAG: without-project" --silent=false
 *
 * PASTING REAL EXTRACTIONS FROM THE APP
 * -------------------------------------
 * 1. In the browser dev tools, find the uploaded document text (or use the
 *    "Extraction diagnostic" rawPddTextPreview + full length).
 * 2. Paste the full raw text below into the MY_PDD_TEXT constant.
 * 3. Add a new it() block that calls printFullDiagnosticReport with your question.
 *
 * The script forces the dev-mode diagnostic path (phase1Diagnostic + matchResults).
 */

import fs from "fs";
import path from "path";

import {
  buildReviewQuestionResult,
  classifyReviewArea,
  extractClaimKeywords,
  computeSectionMatchResults,
  type ReviewQuestionResult,
} from "@/lib/chat/quickCheckReviewQuestion";

import {
  extractPddSections,
  analyzeSectionCandidates,
  normalizeSectionKey,
  type SectionCandidateDebug,
} from "@/lib/chat/quickCheckSectionExtractor";

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const PLUM_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "quick-check", "plum-pdd-regression.txt");
const PLUM_TEXT = fs.readFileSync(PLUM_FIXTURE_PATH, "utf-8");

const PD_REDD_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "quick-check", "pd_redd_v1_130-extracted.txt");
const PD_REDD_TEXT = fs.readFileSync(PD_REDD_FIXTURE_PATH, "utf-8");

const VM0007_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "quick-check", "vm0007-pdd-extracted.txt");
const VM0007_TEXT = fs.readFileSync(VM0007_FIXTURE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// EASY PLACE TO PASTE A REAL EXTRACTION FROM THE RUNNING APP
// ---------------------------------------------------------------------------
const MY_PDD_TEXT = ``; // <-- paste full extracted text here when debugging a real upload

// ---------------------------------------------------------------------------
// TARGET QUESTIONS FROM THE USER'S CURRENT FALSE NEGATIVES
// ---------------------------------------------------------------------------
const QUESTION_STAKEHOLDER = "Does this PDD describe stakeholder engagement?";
const QUESTION_WITHOUT_PROJECT = "Does this PDD explain the without-project land use scenario and additionality?";

// Also useful variants
const QUESTION_STAKEHOLDER_VARIANT = "stakeholder engagement";
const QUESTION_2_2_VARIANT = "without-project land use scenario and additionality";

// ---------------------------------------------------------------------------
// DIAGNOSTIC PRINTER
// ---------------------------------------------------------------------------

interface DiagnosticReport {
  claimText: string;
  reviewArea: string;
  claimKeywords: { phrases: string[]; words: string[] };
  detectedSections: string[];
  relevantSections: string[];
  sectionContentKeys: string[];
  targets: Record<string, {
    existsInDetected: boolean;
    titleInExtracted: string | null;
    sectionContentPresent: boolean;
    matchResult: any;
    sectionCandidates: SectionCandidateDebug | null;
  }>;
  allMatchResults: any[];
  rawPddTextLength: number;
  rawPddTextPreview: string;
}

function buildDiagnosticReport(
  claimText: string,
  rawPddText: string,
  fixtureLabel: string
): DiagnosticReport {
  // Force dev-mode diagnostics inside buildReviewQuestionResult
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  const result: ReviewQuestionResult = buildReviewQuestionResult({
    claimText,
    methodologyId: "VM0007",
    methodologyVersion: "1.0",
    rawPddText,
  });

  process.env.NODE_ENV = prevEnv;

  const phase1 = result.phase1Diagnostic;
  const allSections = extractPddSections(rawPddText);

  const targetsToInspect = ["2.2", "2.3", "2.1", "2.5", "2.4", "1.10", "3.3"];

  const targets: DiagnosticReport["targets"] = {};

  for (const num of targetsToInspect) {
    const key = normalizeSectionKey(num);
    const content = result.sectionContent[num] || result.sectionContent[key] || allSections[key];
    const match = phase1?.matchResults?.find((m: any) => normalizeSectionKey(m.section) === key);
    const candidate = phase1?.sectionCandidates?.[key] || null;

    targets[num] = {
      existsInDetected: key in allSections || Object.keys(allSections).some(k => normalizeSectionKey(k) === key),
      titleInExtracted: content ? (content.split("\n").find(l => l.trim().length > 0) ?? null) : null,
      sectionContentPresent: !!result.sectionContent[num] || !!result.sectionContent[key],
      matchResult: match ? {
        section: match.section,
        headingTitle: match.headingTitle,
        headingScore: match.headingScore,
        bodyScore: match.bodyScore,
        totalScore: match.totalScore,
        included: match.included,
        rejectionReason: match.rejectionReason,
        matchedTerms: match.matchedTerms,
        source: match.source,
      } : null,
      sectionCandidates: candidate,
    };
  }

  return {
    claimText,
    reviewArea: classifyReviewArea(claimText),
    claimKeywords: extractClaimKeywords(claimText),
    detectedSections: phase1?.detectedSections ?? Object.keys(allSections),
    relevantSections: result.relevantSections,
    sectionContentKeys: Object.keys(result.sectionContent),
    targets,
    allMatchResults: phase1?.matchResults ?? [],
    rawPddTextLength: rawPddText.length,
    rawPddTextPreview: rawPddText.replace(/\s+/g, " ").slice(0, 300),
  };
}

function printFullDiagnosticReport(
  claimText: string,
  rawPddText: string,
  fixtureLabel: string
): void {
  const report = buildDiagnosticReport(claimText, rawPddText, fixtureLabel);

  const sep = "═".repeat(80);
  const sub = "─".repeat(80);

  console.log(`\n${sep}`);
  console.log(`DIAGNOSTIC: ${fixtureLabel}`);
  console.log(sep);

  console.log("\nCLAIM TEXT");
  console.log(sub);
  console.log(claimText);

  console.log("\nREVIEW AREA (classifyReviewArea)");
  console.log(sub);
  console.log(report.reviewArea);

  console.log("\nCLAIM KEYWORDS (extractClaimKeywords)");
  console.log(sub);
  console.log("phrases:", JSON.stringify(report.claimKeywords.phrases));
  console.log("words:  ", JSON.stringify(report.claimKeywords.words));

  console.log("\nDOCUMENT STATS");
  console.log(sub);
  console.log("rawPddTextLength:", report.rawPddTextLength);
  console.log("preview:         ", report.rawPddTextPreview + "...");

  console.log("\nDETECTED SECTIONS (keys returned by extractPddSections)");
  console.log(sub);
  console.log(report.detectedSections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", "));

  console.log("\nRELEVANT SECTIONS (what buildReviewQuestionResult decided to surface)");
  console.log(sub);
  console.log(report.relevantSections.length ? report.relevantSections.join(", ") : "(none)");

  console.log("\nSECTION CONTENT KEYS (actually present in the returned result)");
  console.log(sub);
  console.log(report.sectionContentKeys.length ? report.sectionContentKeys.join(", ") : "(none)");

  console.log(`\n${sep}`);
  console.log("TARGET SECTION ANALYSIS (2.2 / 2.3 / 2.1 / 2.5 + common others)");
  console.log(sep);

  const interesting = ["2.2", "2.3", "2.1", "2.5", "2.4", "1.10"];
  for (const num of interesting) {
    const t = report.targets[num];
    if (!t) continue;

    console.log(`\n### Section ${num}`);
    console.log("  detected by extractPddSections? :", t.existsInDetected);
    console.log("  title stored for scoring        :", JSON.stringify(t.titleInExtracted));
    console.log("  appeared in final sectionContent?:", t.sectionContentPresent);

    if (t.matchResult) {
      const m = t.matchResult;
      console.log("  --- matchResult ---");
      console.log("  headingScore     :", m.headingScore);
      console.log("  bodyScore        :", m.bodyScore);
      console.log("  totalScore       :", m.totalScore);
      console.log("  included         :", m.included);
      console.log("  rejectionReason  :", m.rejectionReason ?? "(none)");
      console.log("  source           :", m.source);
      console.log("  matchedTerms     :", JSON.stringify(m.matchedTerms));
      console.log("  headingTitle used:", JSON.stringify(m.headingTitle));
    } else {
      console.log("  (no matchResult entry for this section)");
    }

    if (t.sectionCandidates) {
      const c = t.sectionCandidates;
      console.log("  --- analyzeSectionCandidates output ---");
      console.log("  selectedCandidate:", c.selectedCandidate);
      console.log("  selectedReason   :", c.selectedReason);
      console.log("  allCandidateLines:", c.allCandidateLines.length ? c.allCandidateLines : "(none)");
      if (c.rejectedCandidates.length > 0) {
        console.log("  rejectedCandidates:");
        for (const r of c.rejectedCandidates) console.log("    -", r);
      }
    } else {
      console.log("  (no sectionCandidates entry — section may not have been considered)");
    }
  }

  console.log(`\n${sep}`);
  console.log("ALL MATCH RESULTS (sorted by totalScore desc, as seen by the UI)");
  console.log(sep);

  const sorted = [...report.allMatchResults].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  for (const m of sorted.slice(0, 15)) {
    const flag = m.included ? "✓" : "✗";
    console.log(
      `${flag} ${m.section.padEnd(6)} | h:${String(m.headingScore).padStart(3)} b:${String(m.bodyScore).padStart(3)} tot:${String(m.totalScore).padStart(3)} | ${m.rejectionReason ?? m.headingTitle?.slice(0, 55) ?? ""}`
    );
  }
  if (sorted.length > 15) console.log(`... (${sorted.length - 15} more)`);

  console.log(`\n${sep}\n`);
}

// ---------------------------------------------------------------------------
// THE ACTUAL DIAGNOSTIC CASES
// ---------------------------------------------------------------------------

describe("Quick Check Matching Diagnostics (run with --silent=false)", () => {
  // These are the two cases the user is currently investigating.
  // They are intentionally not using .only so the whole file can be run.

  it("DIAG: stakeholder engagement → expected 2.3 (PLUM regression fixture)", () => {
    printFullDiagnosticReport(QUESTION_STAKEHOLDER, PLUM_TEXT, "PLUM (clean regression)");
  });

  it("DIAG: without-project land use scenario + additionality → expected 2.2 (PLUM)", () => {
    printFullDiagnosticReport(QUESTION_WITHOUT_PROJECT, PLUM_TEXT, "PLUM (clean regression)");
  });

  // Same questions against a real extracted PDF that contains paren headings and page noise.
  // Useful to see whether the title corruption bug we already found affects scoring.
  it("DIAG: stakeholder engagement (PD_REDD real extraction with paren headings)", () => {
    printFullDiagnosticReport(QUESTION_STAKEHOLDER, PD_REDD_TEXT, "PD_REDD_v1_130 (real extraction)");
  });

  it("DIAG: without-project scenario (PD_REDD real extraction)", () => {
    printFullDiagnosticReport(QUESTION_WITHOUT_PROJECT, PD_REDD_TEXT, "PD_REDD_v1_130 (real extraction)");
  });

  // Quick sanity on the VM0007 fixture used in many unit tests
  it("DIAG: stakeholder engagement (VM0007 fixture)", () => {
    printFullDiagnosticReport(QUESTION_STAKEHOLDER, VM0007_TEXT, "VM0007 extracted fixture");
  });

  // If the developer pastes something into MY_PDD_TEXT above, this will run it.
  if (MY_PDD_TEXT && MY_PDD_TEXT.trim().length > 100) {
    it("DIAG: stakeholder on MY_PDD_TEXT (paste from real upload)", () => {
      printFullDiagnosticReport(QUESTION_STAKEHOLDER, MY_PDD_TEXT, "USER_PASTED");
    });

    it("DIAG: without-project on MY_PDD_TEXT (paste from real upload)", () => {
      printFullDiagnosticReport(QUESTION_WITHOUT_PROJECT, MY_PDD_TEXT, "USER_PASTED");
    });
  }
});

// ---------------------------------------------------------------------------
// OPTIONAL: Export a function so it can be required from other scripts later
// ---------------------------------------------------------------------------
export { printFullDiagnosticReport, buildDiagnosticReport };
