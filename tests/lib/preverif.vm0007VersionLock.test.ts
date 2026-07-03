import { describe, expect, it } from "@jest/globals";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  buildMethodologyVersionLock,
  type MethodologyEvidenceAuditSummary,
  type MethodologyEvidenceContract,
} from "@/lib/preverif/evidenceAudit";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { readQuickCheckFixtureText, VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");

function auditVm0007(
  rawText: string,
  options?: {
    versionContext?: {
      pddDeclaredMethodologyVersion: string;
    };
    getContract?: (rule: (typeof VM0007_SYNCED_RULES)[number]) => MethodologyEvidenceContract;
  },
): MethodologyEvidenceAuditSummary {
  const context = getStructuredQueryContext(rawText);
  return auditEvidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument: context.evidenceDocument,
    getContract: options?.getContract ?? getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText,
    versionContext: options?.versionContext,
  });
}

function makeVersionedContract(version: string) {
  return (rule: (typeof VM0007_SYNCED_RULES)[number]): MethodologyEvidenceContract => ({
    ...getVm0007EvidenceContract(rule),
    rulebookVersion: version,
  });
}

describe("VM0007 version lock", () => {
  it("documents the lock inputs and blocks mismatched versions before rule-level judgment", () => {
    const lock = buildMethodologyVersionLock({
      methodologyId: "VM0007",
      rulebookVersion: "v1.8",
      pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
    });

    expect(lock.methodologyId).toBe("VM0007");
    expect(lock.rulebookVersion).toBe("v1.8");
    expect(lock.versionMatch).toBe(false);
    expect(lock.versionMismatchReason).toContain("rulebook version");
  });

  it("blocks Envira when the PDD-declared VM0007 version does not match the loaded v1.8 contract", () => {
    const audit = auditVm0007(ENVIRA_TEXT, {
      getContract: makeVersionedContract("v1.8"),
      versionContext: {
        pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
      },
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.methodologyId).toBe("VM0007");
    expect(audit.rulebookVersion).toBe("v1.8");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("v1.5");
    expect(audit.versionMismatchReason).toContain("v1.8");
    expect(audit.results).toEqual([]);
    expect(Object.values(audit.totals)).toEqual([0, 0, 0, 0, 0]);
  });

  it("allows a matching VM0007 v1.8 PDD to proceed to normal evidence judgment", () => {
    const audit = auditVm0007(ENVIRA_TEXT, {
      getContract: makeVersionedContract("v1.8"),
      versionContext: {
        pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.8",
      },
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.methodologyId).toBe("VM0007");
    expect(audit.rulebookVersion).toBe("v1.8");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
    expect(audit.results).toHaveLength(58);
    expect(audit.results[0]?.methodologyId).toBe("VM0007");
    expect(audit.results[0]?.rulebookVersion).toBe("v1.8");
    expect(audit.results[0]?.pddDeclaredMethodologyVersion).toBe("REDD-MF / VM0007 v1.8");
    expect(audit.results.every((result) => result.versionMatch === true)).toBe(true);
    expect(audit.results.every((result) => result.versionMismatchReason === "")).toBe(true);
  });
});
