import { describe, expect, it } from "@jest/globals";
import {
  getVm0007EvidenceContract,
  getVm0007EvidenceContracts,
  normalizeVm0007RuleId,
  VM0007_FALLBACK_EVIDENCE_CONTRACT,
  type Vm0007RuleLike,
} from "@/lib/preverif/vm0007EvidenceContracts";

type Vm0007RuleFixture = Vm0007RuleLike;

// Keep the synced VM0007 rule inventory in a tracked test fixture so CI does not
// depend on a locally fetched methodology pack under public/methodologies.
const VM0007_SYNCED_RULES: readonly Vm0007RuleFixture[] = [
  { id: "R-1-0001", summary: "REDD forest land definition", type: "eligibility" },
  { id: "R-1-0002", summary: "REDD baseline deforestation category", type: "eligibility" },
  { id: "R-1-0003", summary: "AUDef agent criteria", type: "eligibility" },
  { id: "R-1-0004", summary: "APDef legal authorization", type: "eligibility" },
  { id: "R-1-0005", summary: "WRC water table prohibition", type: "eligibility" },
  { id: "R-1-0006", summary: "WRC organic soil burning prohibition", type: "eligibility" },
  { id: "R-1-0007", summary: "WRC nitrogen fertilizer prohibition", type: "eligibility" },
  { id: "R-1-0008", summary: "WRC hydrological connectivity check", type: "eligibility" },
  { id: "R-1-0009", summary: "RWE prior land use requirement", type: "eligibility" },
  { id: "R-1-0010", summary: "Peatland VCS definition", type: "eligibility" },
  { id: "R-1-0011", summary: "Tidal wetland restoration activities", type: "eligibility" },
  { id: "R-1-0012", summary: "CIW tidal wetland conservation activities", type: "eligibility" },
  { id: "R-1-0013", summary: "AUWD agent criteria", type: "eligibility" },
  { id: "R-1-0014", summary: "IFM and ARR exclusion", type: "eligibility" },
  { id: "R-1-0015", summary: "Leakage prevention activity restrictions", type: "eligibility" },
  { id: "R-2-0001", summary: "Geographic boundary definition", type: "eligibility" },
  { id: "R-2-0002", summary: "No spatial overlap between baselines", type: "eligibility" },
  { id: "R-2-0003", summary: "Exclusion of land in other GHG programs", type: "monitoring" },
  { id: "R-2-0004", summary: "REDD reference region definition", type: "eligibility" },
  { id: "R-2-0005", summary: "REDD proxy area definition", type: "eligibility" },
  { id: "R-2-0006", summary: "Stratification requirement", type: "eligibility" },
  { id: "R-2-0007", summary: "Carbon pool selection per activity type", type: "eligibility" },
  { id: "R-2-0008", summary: "REDD mandatory carbon pools", type: "calc" },
  { id: "R-2-0009", summary: "WRC carbon pools", type: "calc" },
  { id: "R-2-0010", summary: "REDD GHG source identification", type: "eligibility" },
  { id: "R-2-0011", summary: "WRC GHG source identification", type: "eligibility" },
  { id: "R-2-0012", summary: "Consistency rule: baseline-project source matching", type: "eligibility" },
  { id: "R-2-0013", summary: "Historical reference period", type: "eligibility" },
  { id: "R-2-0014", summary: "Crediting period duration", type: "eligibility" },
  { id: "R-2-0015", summary: "WRC 100-year SOC difference requirement", type: "calc" },
  { id: "R-2-0016", summary: "Tidal wetland sea-level rise boundary", type: "eligibility" },
  { id: "R-3-0001", summary: "Baseline scenario determination via VT0001", type: "calc" },
  { id: "R-3-0002", summary: "Minimum alternative scenario list", type: "eligibility" },
  { id: "R-3-0003", summary: "Barrier analysis baseline selection", type: "calc" },
  { id: "R-3-0004", summary: "Investment analysis baseline selection", type: "calc" },
  { id: "R-3-0005", summary: "REDD baseline modules", type: "calc" },
  { id: "R-3-0006", summary: "WRC baseline modules", type: "calc" },
  { id: "R-3-0007", summary: "Baseline reassessment frequency", type: "monitoring" },
  { id: "R-3-0008", summary: "JNR data use", type: "calc" },
  { id: "R-4-0001", summary: "VT0001 additionality requirement", type: "eligibility" },
  { id: "R-4-0002", summary: "Tidal wetland additionality method", type: "eligibility" },
  { id: "R-5-0001", summary: "REDD net emission reduction equation", type: "equation" },
  { id: "R-5-0002", summary: "WRC net emission reduction equation", type: "equation" },
  { id: "R-5-0003", summary: "REDD leakage components", type: "calc" },
  { id: "R-5-0004", summary: "WRC leakage components", type: "calc" },
  { id: "R-5-0005", summary: "Buffer pool contribution calculation", type: "calc" },
  { id: "R-5-0006", summary: "Uncertainty adjustment", type: "uncertainty" },
  { id: "R-5-0007", summary: "VCU calculation", type: "equation" },
  { id: "R-5-0008", summary: "Carbon pool modules for REDD", type: "calc" },
  { id: "R-5-0009", summary: "Project emissions modules", type: "calc" },
  { id: "R-6-0001", summary: "Monitoring plan four tasks", type: "monitoring" },
  { id: "R-6-0002", summary: "Monitoring plan content requirements", type: "monitoring" },
  { id: "R-6-0003", summary: "Geographic position recording", type: "monitoring" },
  { id: "R-6-0004", summary: "SOP and QA/QC requirements", type: "monitoring" },
  { id: "R-6-0005", summary: "REDD forest cover monitoring", type: "monitoring" },
  { id: "R-6-0006", summary: "WRC compliance monitoring", type: "monitoring" },
  { id: "R-6-0007", summary: "Expert judgment documentation", type: "monitoring" },
  { id: "R-6-0008", summary: "Uncertainty reduction requirements", type: "uncertainty" },
];

describe("VM0007 evidence contracts", () => {
  it("maps every synced VM0007 rule to a concrete contract without using fallback for the current canon", () => {
    const fallbackRules = VM0007_SYNCED_RULES
      .map((rule) => ({
        ruleId: normalizeVm0007RuleId(rule.id),
        contractId: getVm0007EvidenceContract(rule).id,
      }))
      .filter((entry) => entry.contractId === VM0007_FALLBACK_EVIDENCE_CONTRACT.id);

    expect(fallbackRules).toEqual([]);
  });

  it("maps high-value rules to their specific override contracts", () => {
    const expectedByRuleId: Record<string, string> = {
      "R-1-0001": "rule:R-1-0001",
      "R-1-0002": "rule:R-1-0002",
      "R-1-0004": "rule:R-1-0004",
      "R-1-0015": "rule:R-1-0015",
      "R-2-0007": "rule:R-2-0007",
      "R-3-0001": "rule:R-3-0001",
      "R-4-0001": "rule:R-4-0001",
      "R-5-0003": "rule:R-5-0003",
      "R-6-0001": "rule:R-6-0001",
      "R-6-0002": "rule:R-6-0002",
    };

    for (const [ruleId, contractId] of Object.entries(expectedByRuleId)) {
      expect(getVm0007EvidenceContract(ruleId).id).toBe(contractId);
    }
  });

  it("keeps the rule-specific override for R-1-0007 when structured rule metadata is available", () => {
    const rule = VM0007_SYNCED_RULES.find((entry) => entry.id === "R-1-0007");

    expect(rule).toBeDefined();
    expect(getVm0007EvidenceContract(rule!).id).toBe("rule:R-1-0007");
  });

  it("maps WRC, tidal, and peatland rules to contracts that can mark the rule not applicable", () => {
    const rules = VM0007_SYNCED_RULES.filter((rule) =>
      /wrc|peatland|tidal wetland|tidal|rwe/i.test(`${rule.title ?? ""} ${rule.summary ?? ""}`),
    );

    expect(rules.length).toBeGreaterThan(0);

    for (const rule of rules) {
      const contract = getVm0007EvidenceContract(rule);
      expect(contract.supportsNotApplicable).toBe(true);
      expect(contract.notApplicableSignals.length).toBeGreaterThan(0);
    }
  });

  it("maps explicit WRC family rule IDs to the wetland not-applicable contract for string-only calls", () => {
    const ruleIds = [
      "R-1-0005",
      "R-1-0006",
      "R-1-0007",
      "R-1-0008",
      "R-1-0009",
      "R-1-0010",
      "R-1-0011",
      "R-1-0012",
      "R-2-0009",
      "R-5-0002",
      "R-6-0006",
    ];

    for (const ruleId of ruleIds) {
      const contract = getVm0007EvidenceContract(ruleId);
      expect(contract.id).toBe("family:wrc-peatland-tidal-na");
      expect(contract.supportsNotApplicable).toBe(true);
      expect(contract.notApplicableSignals.length).toBeGreaterThan(0);
    }
  });

  it("gives every contract client action text", () => {
    const contracts = [...getVm0007EvidenceContracts(), VM0007_FALLBACK_EVIDENCE_CONTRACT];

    for (const contract of contracts) {
      expect(contract.clientAction.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not use blocked reviewer-language shortcuts in contracts", () => {
    const contracts = [...getVm0007EvidenceContracts(), VM0007_FALLBACK_EVIDENCE_CONTRACT];
    const forbidden = /\bpassed\b|\bverified\b|vvb-grade|all clear/i;

    for (const contract of contracts) {
      expect(JSON.stringify(contract)).not.toMatch(forbidden);
    }
  });
});
