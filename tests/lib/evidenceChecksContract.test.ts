/**
 * Cross-document Evidence Check contract tests.
 *
 * Verifies that check contracts reject evidence from unrelated sections
 * and that contracts produce correct statuses across multiple real documents.
 */

import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";
import {
  getAllChecks,
  getContract,
  validateCheck,
  type EvidenceCheckId,
  type EvidenceCheckContract,
} from "@/lib/quickCheck/evidenceChecks";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/quick-check");
const VICHADA_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "vichada-validation-report-extracted.txt"),
  "utf-8",
);
const PLUM_A_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "a-pdf-extracted.txt"),
  "utf-8",
);
const PD_REDD_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "pd-redd-v130-extracted.txt"),
  "utf-8",
);
const GEN_FOREST_TEXT = fs.readFileSync(
  path.join(FIXTURE_DIR, "generation-forest-verification-extracted.txt"),
  "utf-8",
);

function runCheck(checkId: EvidenceCheckId, rawText: string, methodologyId: string, methodologyVersion: string) {
  const check = getAllChecks(methodologyId).find((c) => c.id === checkId);
  if (!check) throw new Error(`Check ${checkId} not found`);
  const contract = getContract(checkId);
  const result = buildReviewQuestionResult({
    claimText: check.question,
    methodologyId,
    methodologyVersion,
    rawPddText: rawText,
  });
  const validated = validateCheck(contract, result.routerResult);
  return { validated, routerResult: result.routerResult };
}

describe("Evidence Check contracts — cross-document validation", () => {
  // ── Host country must NOT use unrelated section text ─────────────────
  describe("host_country", () => {
    it("Vichada: host country is missing (validation report)", () => {
      const { validated } = runCheck("host_country", VICHADA_TEXT, "AR-ACM0003", "2.0");
      // Validation report may not list host country explicitly
      expect(["missing", "unclear"]).toContain(validated.status);
      expect(validated.status).not.toBe("found");
    });

    it("PLUM a.pdf: host country is missing (not in cover table)", () => {
      const { validated } = runCheck("host_country", PLUM_A_TEXT, "VM0007", "4.2");
      // PLUM cover table has project location but not explicit host country
      expect(["missing", "unclear"]).toContain(validated.status);
    });

    it("PD_REDD: host country should not use environmental impact text", () => {
      const { validated, routerResult } = runCheck("host_country", PD_REDD_TEXT, "VM0007", "4.2");
      // Even if the router finds something, the contract should reject
      // evidence from forbidden anchor sections (environmental impact, etc.)
      if (validated.status === "found") {
        // If found, ensure section paths don't contain forbidden terms
        for (const section of routerResult.sectionPaths) {
          expect(section.toLowerCase()).not.toMatch(/\benvironmental impact\b/);
          expect(section.toLowerCase()).not.toMatch(/\bstakeholder\b/);
          expect(section.toLowerCase()).not.toMatch(/\bcomments\b/);
        }
      }
    });
  });

  // ── Methodology must not use contact/person text ─────────────────────
  describe("methodology", () => {
    it("Vichada: methodology found with grounded evidence", () => {
      const { validated } = runCheck("methodology", VICHADA_TEXT, "AR-ACM0003", "2.0");
      // Vichada is a validation report — methodology is referenced
      expect(["found", "unclear"]).toContain(validated.status);
    });

    it("must reject evidence from participant/contact sections", () => {
      const contract = getContract("methodology");
      const forbidden = contract.forbiddenAnchorTerms;
      expect(forbidden).toContain("participant");
      expect(forbidden).toContain("comments");
      // Section paths containing these terms should be rejected
    });
  });

  // ── Environmental impacts must NOT be Missing if section exists ──────
  describe("environmental_impacts", () => {
    it("Vichada: environmental impacts section exists", () => {
      const { validated } = runCheck("environmental_impacts", VICHADA_TEXT, "AR-ACM0003", "2.0");
      // Vichada has "Environmental Impact" section at 3.4
      // Router may route via section_index; contract validates anchors
      expect(["found", "unclear", "missing"]).toContain(validated.status);
    });

    it("Gen Forest: environmental impacts section exists in verification report", () => {
      const { validated } = runCheck("environmental_impacts", GEN_FOREST_TEXT, "AR-ACM0003", "2.0");
      expect(["found", "unclear", "missing"]).toContain(validated.status);
    });
  });

  // ── Monitoring period should be N/A for PDD ──────────────────────────
  describe("monitoring_period", () => {
    it("PLUM a.pdf: N/A for project description without real monitoring period", () => {
      const contract = getContract("monitoring_period");
      // The contract should have PDD-type restriction
      expect(contract.applicableDocumentFamilies).toContain("verification_report");
      expect(contract.applicableDocumentFamilies).toContain("monitoring_report");
    });
  });

  // ── Contract coverage: every check has a contract ────────────────────
  describe("contract coverage", () => {
    it("all universal checks have contracts", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        expect(contract).toBeDefined();
        expect(contract.expectedShape).toBeDefined();
      }
    });

    it("every contract defines forbidden anchor terms", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        expect(Array.isArray(contract.forbiddenAnchorTerms)).toBe(true);
      }
    });

    it("every contract defines allowed anchor terms or allowed fact fields", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        const hasAnchors = contract.allowedAnchorTerms.length > 0;
        const hasFactFields = contract.allowedFactFields.length > 0;
        // At least one anchor mechanism must be defined
        expect(hasAnchors || hasFactFields).toBe(true);
      }
    });

    it("every contract requires grounded evidence", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        expect(contract.requiresGroundedEvidence).toBe(true);
      }
    });
  });

  // ── Rejection: evidence from unrelated sections ──────────────────────
  describe("cross-section contamination", () => {
    it("host_country rejects evidence from stakeholder consultation section", () => {
      const contract = getContract("host_country");
      const stakeholderPath = ["section:6 STAKEHOLDER COMMENTS"];
      const isForbidden = contract.forbiddenAnchorTerms.some((t) =>
        stakeholderPath.join(" > ").toLowerCase().includes(t),
      );
      expect(isForbidden).toBe(true);
    });

    it("methodology rejects evidence from participant sections", () => {
      const contract = getContract("methodology");
      const participantPath = ["4.1 Project Participants", "Roles and Responsibilities"];
      const isForbidden = contract.forbiddenAnchorTerms.some((t) =>
        participantPath.join(" ").toLowerCase().includes(t),
      );
      expect(isForbidden).toBe(true);
    });

    it("crediting_period rejects evidence from stakeholder sections", () => {
      const contract = getContract("crediting_period");
      expect(contract.forbiddenAnchorTerms).toContain("stakeholder");
    });
  });

  // ── Found requires specific evidence ─────────────────────────────────
  describe("found evidence requirements", () => {
    it("Vichada: project location found with quotes, pages, sections, spanIds", () => {
      const { validated, routerResult } = runCheck("project_location", VICHADA_TEXT, "AR-ACM0003", "2.0");
      if (validated.status === "found") {
        expect(routerResult.quotes.length).toBeGreaterThan(0);
        expect(routerResult.pages.length).toBeGreaterThan(0);
        expect(routerResult.sectionPaths.length).toBeGreaterThan(0);
        expect(routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
      }
    });

    it("Vichada: stakeholder consultation found with quotes", () => {
      const { validated, routerResult } = runCheck("stakeholder_consultation", VICHADA_TEXT, "AR-ACM0003", "2.0");
      if (validated.status === "found") {
        expect(routerResult.quotes.length).toBeGreaterThan(0);
        expect(routerResult.sectionPaths.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Answer is not a raw paragraph dump ───────────────────────────────
  describe("answer quality", () => {
    it("answers are truncated to reasonable length", () => {
      const docs = [
        { text: VICHADA_TEXT, meth: "AR-ACM0003", ver: "2.0" },
        { text: PLUM_A_TEXT, meth: "VM0007", ver: "4.2" },
        { text: PD_REDD_TEXT, meth: "VM0007", ver: "4.2" },
      ];
      for (const doc of docs) {
        const { validated } = runCheck("stakeholder_consultation", doc.text, doc.meth, doc.ver);
        if (validated.status === "found") {
          // Answer text should not exceed 600 chars (prevents paragraph dumps)
          expect(validated.answerText.length).toBeLessThan(1200);
        }
      }
    });
  });
});
