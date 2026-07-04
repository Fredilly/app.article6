import { describe, expect, it } from "@jest/globals";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  buildMethodologyVersionLock,
  type MethodologyEvidenceAuditSummary,
  type MethodologyEvidenceContract,
} from "@/lib/preverif/evidenceAudit";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { readQuickCheckFixtureText, VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");
const ENVIRA_V18_VERSION_TEXT = ENVIRA_TEXT.replace("VM0007 Version 4.2", "VM0007, version 1.8");
const ENVIRA_V18_FRAMEWORK_TEXT = ENVIRA_TEXT.replace("VM0007 Version 4.2", "REDD-MF, REDD Methodology Framework Version 1.8");

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

function auditVm0007WithDocument(
  evidenceDocument: EvidenceDocument,
  rawText: string,
  options?: {
    versionContext?: {
      pddDeclaredMethodologyVersion: string;
    };
    getContract?: (rule: (typeof VM0007_SYNCED_RULES)[number]) => MethodologyEvidenceContract;
  },
): MethodologyEvidenceAuditSummary {
  return auditEvidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument,
    getContract: options?.getContract ?? getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: [],
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

function makeTableEvidenceDocument(rows: string[][], heading = "Title and Reference of Methodology"): EvidenceDocument {
  const cells = rows.flatMap((row, rowIndex) =>
    row.map((text, columnIndex) => ({
      rowIndex,
      columnIndex,
      text,
      normalizedText: text.trim().toLowerCase(),
    })),
  );

  return {
    docId: "vm0007-version-lock-test",
    rawText: rows.map((row) => row.join(" | ")).join("\n"),
    spans: [
      {
        spanId: "span-table-1",
        docId: "vm0007-version-lock-test",
        page: 83,
        sectionId: "section:3.1",
        heading,
        headingPath: ["Application of Methodology", heading],
        sectionPath: ["Application of Methodology", heading],
        blockType: "table",
        text: rows.map((row) => row.join(" | ")).join("\n"),
        normalizedText: rows.map((row) => row.join(" | ")).join("\n").toLowerCase(),
        charStart: 0,
        charEnd: null,
        table: {
          rowCount: rows.length,
          columnCount: Math.max(...rows.map((row) => row.length)),
          headerRowCount: 1,
          cells,
        },
        reliability: "primary",
        confidence: 100,
      } as EvidenceDocument["spans"][number],
    ],
  };
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

  it("blocks a VM0007 v1.5-only PDD against a loaded v1.8 contract", () => {
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

  it("blocks ambiguous VM0007 versions when both v1.5 and v1.8 are present", () => {
    const ambiguousText = "REDD-MF / VM0007 v1.5 and later VM0007 v1.8";

    const lock = buildMethodologyVersionLock({
      methodologyId: "VM0007",
      rulebookVersion: "v1.8",
      pddDeclaredMethodologyVersion: ambiguousText,
    });

    expect(lock.versionMatch).toBe(false);
    expect(lock.versionMismatchReason).toContain("ambiguous");
    expect(lock.versionMismatchReason).toContain("v1.5");
    expect(lock.versionMismatchReason).toContain("v1.8");

    const audit = auditVm0007(ambiguousText, {
      getContract: makeVersionedContract("v1.8"),
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("ambiguous");
    expect(audit.results).toEqual([]);
  });

  it("allows a matching VM0007 v1.8 PDD to proceed to normal evidence judgment", () => {
    const audit = auditVm0007(ENVIRA_TEXT, {
      getContract: makeVersionedContract("v1-8"),
      versionContext: {
        pddDeclaredMethodologyVersion: "VM0007 Version 1.8",
      },
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.methodologyId).toBe("VM0007");
    expect(audit.rulebookVersion).toBe("v1-8");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
    expect(audit.results).toHaveLength(58);
    expect(audit.results[0]?.methodologyId).toBe("VM0007");
    expect(audit.results[0]?.rulebookVersion).toBe("v1-8");
    expect(audit.results[0]?.pddDeclaredMethodologyVersion).toBe("VM0007 Version 1.8");
    expect(audit.results.every((result) => result.versionMatch === true)).toBe(true);
    expect(audit.results.every((result) => result.versionMismatchReason === "")).toBe(true);
  });

  it("allows a methodology table row for VM0007 v1.8 even when module and tool rows have other versions", () => {
    const document = makeTableEvidenceDocument([
      ["Type", "Reference ID", "Version"],
      ["Methodology", "VM0007", "1.8"],
      ["Module", "VMD0001", "1.2"],
      ["Module", "VMD0005", "1.1"],
      ["Tool", "VT0001", "4.2"],
      ["Module", "VMD0002", "1.3"],
      ["Tool", "VT0002", "2.2"],
      ["Tool", "VT0003", "3.0"],
    ]);

    const audit = auditVm0007WithDocument(document, document.rawText, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
  });

  it("allows a Lisala-style methodology table row for VM0007 v1.8", () => {
    const document = makeTableEvidenceDocument([
      ["Type", "Reference ID", "Version"],
      ["Methodology", "VM0007", "1.8"],
      ["Module", "VMD0015", "2.1"],
      ["Module", "VMD0006", "1.2"],
      ["Tool", "VT0001", "3.0"],
      ["Tool", "VT0002", "1.1"],
    ]);

    const audit = auditVm0007WithDocument(document, document.rawText, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
  });

  it("allows prose text written as 'VM0007 (v.1.8)'", () => {
    const audit = auditVm0007("Section 3.1 Application of Methodology\nThe project applies VM0007 (v.1.8) for avoided deforestation.", {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
  });

  it("blocks a methodology table row for VM0007 v1.5 even when module and tool rows have other versions", () => {
    const document = makeTableEvidenceDocument([
      ["Type", "Reference ID", "Version"],
      ["Methodology", "VM0007", "1.5"],
      ["Module", "VMD0001", "1.2"],
      ["Module", "VMD0005", "1.1"],
      ["Tool", "VT0001", "4.2"],
      ["Module", "VMD0002", "1.3"],
      ["Tool", "VT0002", "2.2"],
      ["Tool", "VT0003", "3.0"],
    ]);

    const audit = auditVm0007WithDocument(document, document.rawText, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("v1.5");
    expect(audit.results).toEqual([]);
  });

  it("blocks when the methodology table row is present but the version cell is empty", () => {
    const document = makeTableEvidenceDocument([
      ["Type", "Reference ID", "Version"],
      ["Methodology", "VM0007", ""],
      ["Module", "VMD0001", "1.2"],
      ["Tool", "VT0001", "4.2"],
    ]);

    const audit = auditVm0007WithDocument(document, document.rawText, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("missing");
    expect(audit.results).toEqual([]);
  });

  it("blocks when the same methodology table row contains both v1.8 and v1.5", () => {
    const document = makeTableEvidenceDocument([
      ["Type", "Reference ID", "Version"],
      ["Methodology", "VM0007", "1.8 and 1.5"],
      ["Module", "VMD0001", "1.2"],
      ["Tool", "VT0001", "4.2"],
    ]);

    const audit = auditVm0007WithDocument(document, document.rawText, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("ambiguous");
    expect(audit.versionMismatchReason).toContain("v1.8");
    expect(audit.versionMismatchReason).toContain("v1.5");
    expect(audit.results).toEqual([]);
  });

  it("blocks when VM0007 is declared without a methodology version in prose", () => {
    const audit = auditVm0007("Section 3.1 Application of Methodology\nThe document identifies VM0007 but does not provide a methodology version.", {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
    expect(audit.versionMatch).toBe(false);
    expect(audit.versionMismatchReason).toContain("missing");
    expect(audit.results).toEqual([]);
  });

  it("recognizes a VM0007 v1.8 declaration written as 'VM0007, version 1.8'", () => {
    const lock = buildMethodologyVersionLock({
      methodologyId: "VM0007",
      rulebookVersion: "v1-8",
      pddDeclaredMethodologyVersion: "VM0007, version 1.8",
    });

    expect(lock.versionMatch).toBe(true);
    expect(lock.versionMismatchReason).toBe("");
  });

  it("recognizes a VM0007 v1.8 declaration written as 'REDD-MF, REDD Methodology Framework Version 1.8'", () => {
    const lock = buildMethodologyVersionLock({
      methodologyId: "VM0007",
      rulebookVersion: "v1-8",
      pddDeclaredMethodologyVersion: "REDD-MF, REDD Methodology Framework Version 1.8",
    });

    expect(lock.versionMatch).toBe(true);
    expect(lock.versionMismatchReason).toBe("");
  });

  it("allows a v1.8 VM0007 PDD when the real text uses 'VM0007, version 1.8'", () => {
    const audit = auditVm0007(ENVIRA_V18_VERSION_TEXT, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
    expect(audit.results).toHaveLength(58);
  });

  it("allows a v1.8 VM0007 PDD when the real text uses 'REDD-MF, REDD Methodology Framework Version 1.8'", () => {
    const audit = auditVm0007(ENVIRA_V18_FRAMEWORK_TEXT, {
      getContract: makeVersionedContract("v1-8"),
    });

    expect(audit.auditStatus).toBe("AUDITED");
    expect(audit.versionMatch).toBe(true);
    expect(audit.versionMismatchReason).toBe("");
    expect(audit.results).toHaveLength(58);
  });
});
