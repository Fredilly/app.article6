import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { loadAndParseExtractedText } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResults } from "@/lib/quickCheckV2/status";

const FIXTURE_DIR = path.resolve("tests/fixtures/quick-check/v2/lisala-drc-pdd");
const EXTRACTED_PATH = path.join(FIXTURE_DIR, "extracted.txt");
const DOCUMENT_ID = "lisala-drc-pdd-extracted";

describe("Quick Check v2 — Lisala truth mismatches", () => {
  it("exercises the generic Lisala regression branches", () => {
    const document = loadAndParseExtractedText(EXTRACTED_PATH, DOCUMENT_ID);
    const results = validateAnswerResults(extractAnswersForAllChecks(document));
    const byCheck = new Map(results.map((result) => [result.checkName, result]));

    const hostCountry = byCheck.get("host_country");
    expect(hostCountry?.status).toBe("FOUND");
    expect(hostCountry?.answer).toBe("Democratic Republic of Congo");

    const baselineScenario = byCheck.get("baseline_scenario");
    expect(baselineScenario?.status).toBe("UNCLEAR");
    expect(baselineScenario?.answer).toBe("Baseline scenario is under development.");

    const additionality = byCheck.get("additionality");
    expect(additionality?.status).toBe("UNCLEAR");
    expect(additionality?.answer).toMatch(/not implemented with the intent of artificially generating greenhouse gas/i);

    const leakage = byCheck.get("leakage");
    expect(leakage?.status).toBe("UNCLEAR");
    expect(leakage?.answer).toBe("Leakage section is under development.");

    const stakeholderConsultation = byCheck.get("stakeholder_consultation");
    expect(stakeholderConsultation?.status).toBe("UNCLEAR");
    expect(stakeholderConsultation?.answer).toBe("Stakeholder consultation section is under development.");

    const methodology = byCheck.get("methodology");
    expect(methodology?.status).toBe("FOUND");
    expect(methodology?.answer).toBe("VM0007 REDD+ Methodology Framework (REDD+ MF) v1.8");
    expect(methodology?.evidence).toBeTruthy();
  });
});
