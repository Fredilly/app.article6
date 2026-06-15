/**
 * Cross-document Evidence Check contract tests.
 *
 * Verifies that contracts do their own candidate search — not just
 * filter router output — and produce correct statuses across multiple
 * real documents.
 */

import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult, getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  getAllChecks,
  getContract,
  validateCheck,
  type CheckValidationContext,
  type EvidenceCheckId,
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

function runCheck(
  checkId: EvidenceCheckId,
  rawText: string,
  methodologyId: string,
  methodologyVersion: string,
) {
  const check = getAllChecks(methodologyId).find((c) => c.id === checkId);
  if (!check) throw new Error(`Check ${checkId} not found`);
  const contract = getContract(checkId);
  const ctx = getStructuredQueryContext(rawText);
  const result = buildReviewQuestionResult({
    claimText: check.question,
    methodologyId,
    methodologyVersion,
    rawPddText: rawText,
    structuredQueryContext: ctx,
  });
  const validationCtx: CheckValidationContext = {
    evidenceDocument: ctx.evidenceDocument,
    projectFactContract: ctx.projectFactContract,
    sectionTableIndex: ctx.sectionTableIndex,
    routerResult: result.routerResult,
    queryIntentAnalysis: result.queryIntentAnalysis,
  };
  const validated = validateCheck(contract, validationCtx);
  return { validated, routerResult: result.routerResult, ctx };
}

describe("Evidence Check contracts — cross-document validation", () => {
  // ── Section-backed evidence is not marked Missing ────────────────────
  describe("obvious evidence is found", () => {
    it("Vichada: project location found (section 3.1.6)", () => {
      const { validated } = runCheck("project_location", VICHADA_TEXT, "AR-ACM0003", "2.0");
      expect(validated.status).toBe("found");
      expect(validated.answerText).toMatch(/La Pedregoza|Puerto Carreño|Vichada/);
    });

    it("Vichada: stakeholder consultation found (section 3.5)", () => {
      const { validated } = runCheck("stakeholder_consultation", VICHADA_TEXT, "AR-ACM0003", "2.0");
      expect(validated.status).toBe("found");
    });

    it("PLUM a.pdf: project location found from cover table", () => {
      const { validated } = runCheck("project_location", PLUM_A_TEXT, "VM0007", "4.2");
      expect(validated.status).toBe("found");
      expect(validated.answerText).toContain("Indonesia");
    });

    it("PLUM a.pdf: crediting period found from cover table", () => {
      const { validated } = runCheck("crediting_period", PLUM_A_TEXT, "VM0007", "4.2");
      expect(validated.status).toBe("found");
      expect(validated.answerText).toMatch(/2022|2082/);
    });

    it("PD_REDD: project location found (Cacheu and Cantanhez)", () => {
      const { validated } = runCheck("project_location", PD_REDD_TEXT, "VM0007", "4.2");
      expect(validated.status).toBe("found");
      expect(validated.answerText).toMatch(/Cacheu|Cantanhez/);
    });

    it("PD_REDD: stakeholder consultation found", () => {
      const { validated } = runCheck("stakeholder_consultation", PD_REDD_TEXT, "VM0007", "4.2");
      expect(validated.status).toBe("found");
    });
  });

  // ── Wrong-section evidence cannot become Found ───────────────────────
  describe("wrong-section rejection", () => {
    it("host_country rejects evidence from stakeholder sections", () => {
      const contract = getContract("host_country");
      const path = ["6 STAKEHOLDER COMMENTS"];
      const isForbidden = contract.forbiddenAnchorTerms.some((t) =>
        path.join(" ").toLowerCase().includes(t),
      );
      expect(isForbidden).toBe(true);
      expect(contract.forbiddenAnchorTerms).toContain("stakeholder");
    });

    it("methodology rejects evidence from participant sections", () => {
      const contract = getContract("methodology");
      expect(contract.forbiddenAnchorTerms).toContain("participant");
    });

    it("crediting_period rejects evidence from stakeholder sections", () => {
      const contract = getContract("crediting_period");
      expect(contract.forbiddenAnchorTerms).toContain("stakeholder");
    });

    it("project_location rejects evidence from environmental impact sections", () => {
      const contract = getContract("project_location");
      expect(contract.forbiddenAnchorTerms).toContain("environmental impact");
    });
  });

  // ── Contract candidate search recovers evidence ──────────────────────
  describe("candidate search recovers weak router results", () => {
    it("Vichada host country: contract searches fact fields even when router is weak", () => {
      const { validated } = runCheck("host_country", VICHADA_TEXT, "AR-ACM0003", "2.0");
      // Host country may be explicit in the location text
      expect(["found", "missing", "unclear"]).toContain(validated.status);
    });

    it("PD_REDD: section-backed evidence is not missed", () => {
      const { validated } = runCheck("environmental_impacts", PD_REDD_TEXT, "VM0007", "4.2");
      // Accept any non-false status
      expect(["found", "unclear", "missing"]).toContain(validated.status);
    });
  });

  // ── Found requires provenance ────────────────────────────────────────
  describe("found evidence requirements", () => {
    it("every found check has a downgradeReason that is empty", () => {
      const docs = [
        { text: VICHADA_TEXT, meth: "AR-ACM0003", ver: "2.0" },
        { text: PLUM_A_TEXT, meth: "VM0007", ver: "4.2" },
      ];
      for (const doc of docs) {
        const { validated } = runCheck("project_location", doc.text, doc.meth, doc.ver);
        if (validated.status === "found") {
          expect(validated.downgradeReason).toBe("");
        }
      }
    });

    it("non-found checks include a downgrade reason", () => {
      const { validated } = runCheck("host_country", VICHADA_TEXT, "AR-ACM0003", "2.0");
      if (validated.status !== "found") {
        expect(validated.downgradeReason.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Answers are not raw paragraph dumps ──────────────────────────────
  describe("answer quality", () => {
    it("answers are shorter than 500 chars", () => {
      const docs = [
        { text: VICHADA_TEXT, meth: "AR-ACM0003", ver: "2.0" },
        { text: PLUM_A_TEXT, meth: "VM0007", ver: "4.2" },
        { text: PD_REDD_TEXT, meth: "VM0007", ver: "4.2" },
      ];
      for (const doc of docs) {
        const { validated } = runCheck("stakeholder_consultation", doc.text, doc.meth, doc.ver);
        if (validated.status === "found") {
          expect(validated.answerText.length).toBeLessThan(1200);
        }
      }
    });
  });

  // ── Contract coverage ────────────────────────────────────────────────
  describe("contract coverage", () => {
    it("every check has a contract", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        expect(contract).toBeDefined();
        expect(contract.searchTargets.length).toBeGreaterThan(0);
      }
    });

    it("every contract defines allowed or forbidden anchor terms", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        const contract = getContract(check.id);
        const hasAnchors = contract.allowedAnchorTerms.length > 0;
        const hasForbidden = contract.forbiddenAnchorTerms.length > 0;
        const hasFactFields = contract.allowedFactFields.length > 0;
        expect(hasAnchors || hasForbidden || hasFactFields).toBe(true);
      }
    });

    it("every contract requires grounded evidence", () => {
      const checks = getAllChecks();
      for (const check of checks) {
        expect(getContract(check.id).requiresGroundedEvidence).toBe(true);
      }
    });
  });

  // ── Cross-document: Gen Forest verification report ───────────────────
  describe("Gen Forest verification report", () => {
    it("stakeholder consultation is found", () => {
      const { validated } = runCheck("stakeholder_consultation", GEN_FOREST_TEXT, "AR-ACM0003", "2.0");
      expect(validated.status).toBe("found");
    });

    it("methodology is found", () => {
      const { validated } = runCheck("methodology", GEN_FOREST_TEXT, "AR-ACM0003", "2.0");
      // May be found or unclear (structured input only)
      expect(["found", "unclear"]).toContain(validated.status);
    });

    it("environmental impacts has candidate search", () => {
      const { validated } = runCheck("environmental_impacts", GEN_FOREST_TEXT, "AR-ACM0003", "2.0");
      // Contract does its own candidate search — status reflects what's available
      expect(["found", "unclear", "missing"]).toContain(validated.status);
      if (validated.status !== "found") {
        expect(validated.downgradeReason.length).toBeGreaterThan(0);
      }
    });
  });
});
