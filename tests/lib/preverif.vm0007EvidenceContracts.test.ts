import { describe, expect, it } from "@jest/globals";
import {
  getVm0007EvidenceContract,
  getVm0007EvidenceContracts,
  normalizeVm0007RuleId,
  VM0007_FALLBACK_EVIDENCE_CONTRACT,
} from "@/lib/preverif/vm0007EvidenceContracts";
import { VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

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
