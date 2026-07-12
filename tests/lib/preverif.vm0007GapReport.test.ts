import { describe, expect, it } from "@jest/globals";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  type MethodologyEvidenceAuditResult,
  type MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";
import {
  NO_PDD_EVIDENCE_TEXT,
  buildVm0007GapReport,
} from "@/lib/preverif/vm0007GapReport";
import {
  getVm0007EvidenceContract,
  normalizeVm0007RuleId,
} from "@/lib/preverif/vm0007EvidenceContracts";
import {
  readQuickCheckFixtureText,
  VM0007_SYNCED_RULES,
} from "./preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");
const ENVIRA_V18_TEXT = ENVIRA_TEXT.replace("VM0007 Version 4.2", "REDD-MF / VM0007 v1.8");

function auditText(rawText: string): MethodologyEvidenceAuditSummary {
  const context = getStructuredQueryContext(rawText);
  return auditEvidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument: context.evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText,
  });
}

function withStatus(
  result: MethodologyEvidenceAuditResult,
  overrides: Partial<MethodologyEvidenceAuditResult>,
): MethodologyEvidenceAuditResult {
  return { ...result, ...overrides };
}

function retotal(results: MethodologyEvidenceAuditResult[]): MethodologyEvidenceAuditSummary["totals"] {
  return {
    supported_by_pdd: results.filter((result) => result.status === "supported_by_pdd").length,
    partially_supported: results.filter((result) => result.status === "partially_supported").length,
    missing_evidence: results.filter((result) => result.status === "missing_evidence").length,
    not_applicable: results.filter((result) => result.status === "not_applicable").length,
    manual_review_needed: results.filter((result) => result.status === "manual_review_needed").length,
  };
}

function buildMixedAudit(): MethodologyEvidenceAuditSummary {
  const base = auditText(ENVIRA_V18_TEXT);
  const results = base.results.map((result) => {
    if (result.ruleId === "R-1-0002") {
      return withStatus(result, {
        status: "partially_supported",
        gap: "The current PDD names the baseline category but does not explain why that category fits the project area.",
        clientAction: "Add the project-specific baseline deforestation category rationale and the supporting land-use evidence.",
      });
    }
    if (result.ruleId === "R-1-0003") {
      return withStatus(result, {
        status: "missing_evidence",
        bestEvidenceQuote: null,
        section: null,
        page: null,
        gap: "The current PDD does not show the AUDef agent evidence required for this rule.",
        clientAction: "Add the project-specific evidence for the relevant deforestation agents and explain how they drive baseline pressure.",
        assessmentReason: "The current PDD does not yet show project-specific evidence for this rule.",
        reasonSelected: "No reliable project-specific span was selected for this rule.",
      });
    }
    if (result.ruleId === "R-1-0005") {
      return withStatus(result, {
        status: "not_applicable",
        bestEvidenceQuote: "This is a REDD/APD project in upland forest landscapes. No peat soils or tidal wetland activity occur in the project area.",
        section: "Project Activity Description",
        page: 2,
        gap: "",
        clientAction: "Keep scope basis clear.",
        assessmentReason: "The current PDD scope statement shows this wetland-specific rule does not apply to the project.",
      });
    }
    return result;
  });

  return {
    results,
    totals: retotal(results),
    totalRules: results.length,
  };
}

function buildSupportedOnlyAudit(): MethodologyEvidenceAuditSummary {
  const base = auditText(ENVIRA_V18_TEXT);
  const results = Array.from({ length: 58 }, (_, index) =>
    withStatus(base.results[index]!, {
      ruleId: `R-6-${String(index + 1).padStart(4, "0")}`,
      stableId: `R-6-${String(index + 1).padStart(4, "0")}`,
      title: `Supported rule ${index + 1}`,
      status: "supported_by_pdd",
      gap: "",
      clientAction: "",
    }),
  );

  return {
    results,
    totals: retotal(results),
    totalRules: results.length,
  };
}

function buildBlockedMismatchAudit(baseAudit: MethodologyEvidenceAuditSummary): MethodologyEvidenceAuditSummary {
  return {
    ...baseAudit,
    auditStatus: "BLOCKED_VERSION_MISMATCH",
    methodologyId: "VM0007",
    rulebookVersion: "v1.8",
    pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
    versionMatch: false,
    versionMismatchReason: "Version lock blocked: rulebook version mismatch: PDD declares v1.5, loaded contract is v1.8.",
    userAcceptedVersionWarning: true,
  };
}

function buildReport(audit: MethodologyEvidenceAuditSummary) {
  return buildVm0007GapReport({
    reportId: "VRGR-VM0007-001",
    generatedAt: "2026-07-01T10:00:00Z",
    project: {
      name: "Envira Amazonia",
      projectId: "VM0007-ENV-001",
      proponent: "Envira Project Dev",
      region: "Brazil",
      description: "Avoided deforestation project with community-focused leakage controls and monitoring procedures.",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
      name: "REDD+ Methodology Framework",
      scope: "Audit output rendered for internal preview follow-up.",
    },
    audit,
  });
}

describe("buildVm0007GapReport", () => {
  it("builds a 58-rule report from existing VM0007 audit output", () => {
    const report = buildReport(auditText(ENVIRA_V18_TEXT));

    expect(report.reportName).toBe("Internal VM0007 Gap Report Preview");
    expect(report.statementOfCoverage).toBe("58 VM0007 rules assessed for validation readiness.");
    expect(report.fullRuleAuditTable).toHaveLength(58);
    expect(report.evidenceAppendix).toHaveLength(58);
  });

  it("adds the internal preview limitation banner and all-supported warning when every rule is supported", () => {
    const report = buildReport(buildSupportedOnlyAudit());

    expect(report.limitationBanner).toBe("Internal preview only. This report shows current audit output and has not been manually reviewed.");
    expect(report.executiveSummary.allSupportedWarning).toBe("All rules are currently marked supported. Review evidence quality before relying on this result.");
  });

  it("prepends the version warning to the report banner when the audit is blocked for a mismatch", () => {
    const report = buildReport(buildBlockedMismatchAudit(auditText(ENVIRA_V18_TEXT)));

    expect(report.limitationBanner).toContain("Methodology version mismatch:");
    expect(report.limitationBanner).toContain("Evidence judgment may be wrong.");
    expect(report.limitationBanner).toContain("Internal preview only. This report shows current audit output and has not been manually reviewed.");
    expect(report.executiveSummary.limitations[0]).toContain("Methodology version mismatch:");
  });

  it("keeps client action guidance on every weak or missing rule", () => {
    const report = buildReport(buildMixedAudit());
    const weakOrMissing = report.fullRuleAuditTable.filter((row) =>
      row.status === "weak" || row.status === "missing",
    );

    expect(report.clientActionList).toHaveLength(weakOrMissing.length);
    for (const row of weakOrMissing) {
      expect(row.gapGuidance.trim().length).toBeGreaterThan(0);
      expect(row.clientAction.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not show remediation guidance on supported rows", () => {
    // This assertion isolates report rendering from audit classification. The
    // mixed Envira fixture is intentionally conservative now, so use an
    // explicitly supported audit when testing supported-row presentation.
    const report = buildReport(buildSupportedOnlyAudit());
    const supported = report.fullRuleAuditTable.find((row) => row.status === "supported");

    expect(supported?.status).toBe("supported");
    expect(supported?.gapGuidance).toBe("");
    expect(supported?.clientAction).toBe("");
  });

  it("does not show remediation guidance on not-applicable rows unless explicitly scope-keeping", () => {
    const report = buildReport(buildMixedAudit());
    const notApplicable = report.fullRuleAuditTable.find((row) => row.ruleId === "R-1-0005");

    expect(notApplicable?.status).toBe("not applicable");
    expect(notApplicable?.gapGuidance).toBe("Keep scope basis clear.");
    expect(notApplicable?.clientAction).toBe("Keep scope basis clear.");
  });
  it("uses selected evidence quotes where available and the fallback text where they are not", () => {
    const report = buildReport(buildMixedAudit());
    const supported = report.evidenceAppendix.find((entry) => entry.ruleId === "R-1-0001");
    const missing = report.evidenceAppendix.find((entry) => entry.ruleId === "R-1-0003");

    // The conservative classifier retains the selected source span, even
    // though this row is no longer treated as fully supported.
    expect(supported?.quote).toBe("REDD-MF / VM0007 v1.8");
    expect(missing?.quote).toBe(NO_PDD_EVIDENCE_TEXT);
  });

  it("keeps banned wording out of the report data", () => {
    const reportJson = JSON.stringify(buildReport(buildMixedAudit())).toLowerCase();
    const banned = [
      ["VVB", "-grade"].join(""),
      ["veri", "fied"].join(""),
      ["validation", " opinion"].join(""),
      ["assurance", " opinion"].join(""),
      ["all", " clear"].join(""),
      ["client", "-facing"].join(""),
      ["external", " use"].join(""),
    ];

    expect(reportJson).not.toContain("58 vm0007 rules passed.");
    for (const item of banned) {
      expect(reportJson).not.toContain(item.toLowerCase());
    }
  });
});
