import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { extractMethodologyMentions } from "@/lib/chat/quickCheckEvidence";
import {
  buildExtractionPreviewViewModel,
  buildQuickCheckExtractionSnapshot,
  deriveQuickCheckExtractionState,
  normalizeQuickCheckUiResult,
} from "@/lib/chat/quickCheckUi";

type QuickCheckFixtureManifest = {
  version: number;
  fixtures: Array<{
    id: string;
    directory: string;
  }>;
};

function collectDisplayedMethodVersions(view: ReturnType<typeof buildExtractionPreviewViewModel>): Array<string | null> {
  return [
    view.primaryMethodology?.version ?? null,
    view.monitoringMethodology?.version ?? null,
    ...(view.referencedMethods?.map((method) => method.version ?? null) ?? []),
  ];
}

function collectDisplayedMethodIds(view: ReturnType<typeof buildExtractionPreviewViewModel>): string[] {
  return [
    view.primaryMethodology?.id,
    view.monitoringMethodology?.id,
    ...(view.referencedMethods?.map((method) => method.id) ?? []),
  ].filter((value): value is string => Boolean(value));
}

function loadQuickCheckV2FixtureViews(): Array<{
  id: string;
  view: ReturnType<typeof buildExtractionPreviewViewModel>;
}> {
  const root = path.join(process.cwd(), "tests/fixtures/quick-check/v2");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  ) as QuickCheckFixtureManifest;

  return manifest.fixtures.map((fixture) => {
    const rawPddText = fs.readFileSync(
      path.join(root, fixture.directory, "extracted.txt"),
      "utf8",
    );
    const methodologyMentions = extractMethodologyMentions(rawPddText);
    const analysis = {
      facts: [],
      parsedEvidenceLabels: [`${fixture.id}.pdf`],
      documentTypes: ["Document"],
      methodologyMentions,
      extractionConfidence: 0.8,
      warnings: [],
      rawPddText,
    };
    const extractionSnapshot = buildQuickCheckExtractionSnapshot({
      claimText: "Methodology extraction preview invariant",
      analysis,
    });

    return {
      id: fixture.id,
      view: buildExtractionPreviewViewModel({
        fileName: `${fixture.id}.pdf`,
        analysis,
        extractionSnapshot,
        methodologyResolution: {
          status: "none",
          rawMentions: methodologyMentions,
          programSignals: [],
          signals: [],
          matchedMethods: [],
          unsupportedCanonicalKeys: [],
          primaryMethodology: null,
        },
      }),
    };
  });
}

describe("quick check ui helpers", () => {
  it("reports explicit methodology/version states instead of confidence-only wording", () => {
    const baseAnalysis = {
      facts: [],
      parsedEvidenceLabels: ["pdd.pdf"],
      documentTypes: ["PDD / PDF"],
      methodologyMentions: ["VM0007"],
      extractionConfidence: 0.2,
      warnings: [],
      rawPddText: "Applied Methodology VM0007 REDD+ Methodology Framework v1.8",
    };
    const resolution = (versionStatus: "VERSION_CONFIRMED" | "VERSION_NOT_CONFIRMED" | "CONFLICTING_DECLARATION", methodologyVersion: string | null) => ({
      status: "single" as const,
      rawMentions: ["VM0007"],
      programSignals: [],
      signals: [],
      matchedMethods: [{
        methodologyId: "VM0007",
        methodologyVersion,
        versionStatus,
        rulebookVersion: "v1.8",
        matchedSignals: ["VM0007"],
        canonicalKeys: ["VM0007"],
        priority: 0,
      }],
      unsupportedCanonicalKeys: [],
      primaryMethodology: null,
    });

    expect(buildExtractionPreviewViewModel({ analysis: baseAnalysis, methodologyResolution: resolution("VERSION_CONFIRMED", "v1.8") }).methodologyState).toBe("Version confirmed");
    expect(buildExtractionPreviewViewModel({ analysis: { ...baseAnalysis, rawPddText: "VM0007 REDD+ Methodology Framework" }, methodologyResolution: resolution("VERSION_NOT_CONFIRMED", null) }).methodologyState).toBe("Version missing");
    expect(buildExtractionPreviewViewModel({ analysis: baseAnalysis, methodologyResolution: resolution("CONFLICTING_DECLARATION", null) }).methodologyState).toBe("Conflicting declaration");
  });

  it("builds a claim-relevant extraction snapshot", () => {
    const snapshot = buildQuickCheckExtractionSnapshot({
      claimText: "The boundary description matches the mapped project area",
      analysis: {
        facts: [
          {
            id: "boundary",
            category: "boundary",
            summary: "The project boundary is described in the PDD",
            matchText: "project boundary described",
            sourceLabel: "malawi-pdd.pdf",
          },
          {
            id: "monitoring",
            category: "monitoring-plan",
            summary: "The project has a documented monitoring plan",
            matchText: "documented monitoring plan",
            sourceLabel: "malawi-pdd.pdf",
          },
        ],
        parsedEvidenceLabels: ["malawi-pdd.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: ["AR-ACM0003"],
        extractionConfidence: 0.73,
        warnings: [],
      },
    });

    expect(snapshot.documentType).toBe("PDD / PDF");
    expect(snapshot.extractedFacts).toEqual(["The project boundary is described in the PDD"]);
    expect(snapshot.methodologyMentions).toEqual(["AR-ACM0003"]);
    expect(snapshot.signals).toEqual({
      parsedEvidenceCount: 1,
      factCount: 2,
      relevantFactCount: 1,
      methodologyMentionCount: 1,
      warningCount: 0,
    });
    expect(deriveQuickCheckExtractionState(snapshot).value).toBe("grounded");
  });

  it("prefers document-specific fact detail in the extraction preview", () => {
    const snapshot = buildQuickCheckExtractionSnapshot({
      claimText: "The monitoring report covers the full reporting period.",
      analysis: {
        facts: [
          {
            id: "reporting-period",
            category: "reporting-period",
            summary: "The file contains an explicit reporting or monitoring period with a date range",
            matchText: "reporting period stated",
            sourceLabel: "malawi-strong-signal-evidence.pdf",
            detail: "Reporting period: 1 January 2025 to 31 December 2025.",
          },
        ],
        parsedEvidenceLabels: ["malawi-strong-signal-evidence.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: ["Gold Standard TPDDTEC, Version 4.0"],
        extractionConfidence: 0.82,
        warnings: [],
      },
    });

    expect(snapshot.extractedFacts).toEqual([
      "The file contains an explicit reporting or monitoring period with a date range: Reporting period: 1 January 2025 to 31 December 2025.",
    ]);
  });

  it("prioritizes specific methodology codes in the extraction preview", () => {
    const snapshot = buildQuickCheckExtractionSnapshot({
      claimText: "The boundary description matches the mapped project area",
      analysis: {
        facts: [
          {
            id: "boundary",
            category: "boundary",
            summary: "The project boundary is described in the PDD",
            matchText: "project boundary described",
            sourceLabel: "plum-verra-demo-excerpt.pdf",
          },
        ],
        parsedEvidenceLabels: ["plum-verra-demo-excerpt.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: ["APD", "ARR", "CCB", "VCS", "VMD0001", "VMD0006", "VMD0009", "VM0007", "REDD+ Methodology Framework"],
        extractionConfidence: 0.81,
        warnings: [],
      },
    });

    expect(snapshot.methodologyMentions).toEqual(["VM0007", "REDD+ Methodology Framework", "VMD0001", "VMD0006"]);
  });

  it("shows the declaration-section methodology as primary for CDM/PDD text with later references", () => {
    const rawPddText = [
      "B.1. Title and reference of the approved baseline methodology applied to the small-scale project activity:",
      "“AMS-II.E – Energy efficiency and fuel switching measures for buildings” (version 8).",
      "For the calculation of the baseline emission coefficient of the electricity displaced “AMS-II.E” remits to",
      "“AMS-I.D – Grid connected renewable electricity generation” (version 10), which ultimately remits to",
      "“ACM0002 – Consolidated baseline methodology for grid connected electricity generation from renewable sources” (version 6).",
    ].join("\n");
    const analysis = {
      facts: [],
      parsedEvidenceLabels: ["mk-pdd-pda3.pdf"],
      documentTypes: ["PDD / PDF"],
      methodologyMentions: extractMethodologyMentions(rawPddText),
      extractionConfidence: 0.86,
      warnings: [],
      rawPddText,
    };
    const extractionSnapshot = buildQuickCheckExtractionSnapshot({
      claimText: "Methodology extraction preview invariant",
      analysis,
    });

    const view = buildExtractionPreviewViewModel({
      fileName: "mk-pdd-pda3.pdf",
      analysis,
      extractionSnapshot,
    });

    expect(view.primaryMethodology).toEqual({
      id: "AMS-II.E",
      version: "v8.0",
      role: "PRIMARY_PROJECT_METHODOLOGY",
      confidence: "high",
    });
    expect(view.referencedMethods).toEqual(expect.arrayContaining([
      {
        id: "ACM0002",
        version: "v6.0",
        role: "REFERENCED_CALCULATION_METHOD",
        confidence: "high",
      },
    ]));
    expect(view.referencedMethods?.some((method) => method.id === "ACM0002")).toBe(true);
  });

  it("builds a grounded extraction preview view model from actual file output", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "fresh-monitoring-report.pdf",
      analysis: {
        facts: [
          {
            id: "reporting-period",
            category: "reporting-period",
            summary: "The file contains an explicit reporting or monitoring period with a date range",
            matchText: "reporting period stated",
            sourceLabel: "fresh-monitoring-report.pdf",
            detail: "Reporting period: 1 January 2025 to 31 December 2025.",
          },
          {
            id: "monitoring",
            category: "monitoring-evidence",
            summary: "The project has documented monitoring evidence",
            matchText: "monitoring evidence",
            sourceLabel: "fresh-monitoring-report.pdf",
          },
        ],
        parsedEvidenceLabels: ["fresh-monitoring-report.pdf"],
        documentTypes: ["Document"],
        methodologyMentions: ["AR-ACM0003"],
        extractionConfidence: 0.78,
        warnings: [],
        rawPddText: "Monitoring report for the full reporting period. AR-ACM0003 methodology reference.",
      },
      methodologyResolution: {
        status: "single",
        rawMentions: ["AR-ACM0003"],
        programSignals: [],
        signals: [],
        matchedMethods: [
          {
            methodologyId: "AR-ACM0003",
            methodologyVersion: "v02-0",
            matchedSignals: ["AR-ACM0003"],
            canonicalKeys: ["AR-ACM0003"],
            priority: 5,
          },
        ],
        unsupportedCanonicalKeys: [],
        primaryMethodology: {
          canonicalKey: "AR-ACM0003",
          supported: true,
          matchedMethod: {
            methodologyId: "AR-ACM0003",
            methodologyVersion: "v02-0",
            matchedSignals: ["AR-ACM0003"],
            canonicalKeys: ["AR-ACM0003"],
            priority: 5,
          },
          secondaryCanonicalKeys: [],
        },
      },
    });

    expect(view.fileName).toBe("fresh-monitoring-report.pdf");
    expect(view.detectedDocumentType).toBe("Monitoring Report");
    expect(view.detectedDocumentConfidence).toBeTruthy();
    expect(view.detectedDocumentEvidence?.length).toBeGreaterThan(0);
    expect(view.detectedDocumentEvidence?.length).toBeLessThanOrEqual(3);
    expect(view.detectedMethodology).toBe("AR-ACM0003 v2.0");
    expect(view.methodologyConfidence).toBe("high");
    expect(view.warning).toBeUndefined();
    expect(view.signalsTitle).toBe("What the file appears to contain");
    expect(view.signals.map((signal) => signal.label)).toEqual(["Monitoring Report", "Reporting period"]);
    expect(view.signalSummary).toBe("This file looks like a monitoring report and mentions reporting period.");
  });

  it("compacts document evidence and trims noisy referenced methods", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "validation-report.pdf",
      analysis: {
        facts: [],
        parsedEvidenceLabels: ["validation-report.pdf"],
        documentTypes: ["Document"],
        documentClassification: {
          documentClass: "validation_report",
          confidence: 0.99,
          evidence: [
            'page 1 title: "VALIDATION REPORT"',
            'repeated header: "VALIDATION REPORT"',
            'page 1 title: "VALIDATIONREPORT"',
            'repeated header: "VALIDATIONREPORT"',
            'page 1 header: "VALIDATION REPORT"',
            'body: "validation opinion"',
          ],
          secondaryCandidates: [],
          warnings: [],
        },
        methodologyMentions: ["VM0007", "VMD0001", "VMD0002", "VMD0010"],
        extractionConfidence: 0.9,
        warnings: [],
        rawPddText: "VALIDATION REPORT",
      },
      extractionSnapshot: {
        documentType: "Document",
        extractedFacts: [],
        methodologyMentions: ["VM0007"],
        methodologyClassification: {
          primaryMethodology: {
            id: "VM0007",
            version: "1.3",
            role: "PRIMARY_PROJECT_METHODOLOGY",
            confidence: "high",
          },
          monitoringMethodology: null,
          referencedMethods: [
            { id: "VMD0001", version: "1.3", role: "TOOL_OR_DEPENDENCY", confidence: "medium" },
            { id: "VMD0002", version: "1.0", role: "TOOL_OR_DEPENDENCY", confidence: "medium" },
            { id: "ACM0010", version: "3.1", role: "REFERENCED_CALCULATION_METHOD", confidence: "high" },
            { id: "AM0015", version: "1.0", role: "REFERENCED_CALCULATION_METHOD", confidence: "medium" },
          ],
        },
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 0,
          relevantFactCount: 0,
          methodologyMentionCount: 1,
          warningCount: 0,
        },
        extractionConfidence: 0.9,
        recoveredLocally: false,
      },
      methodologyResolution: {
        status: "single",
        rawMentions: ["VM0007"],
        programSignals: [],
        signals: [],
        matchedMethods: [
          {
            methodologyId: "VM0007",
            methodologyVersion: "v1-3",
            matchedSignals: ["VM0007"],
            canonicalKeys: ["VM0007"],
            priority: 5,
          },
        ],
        unsupportedCanonicalKeys: [],
        primaryMethodology: {
          canonicalKey: "VM0007",
          supported: true,
          matchedMethod: {
            methodologyId: "VM0007",
            methodologyVersion: "v1-3",
            matchedSignals: ["VM0007"],
            canonicalKeys: ["VM0007"],
            priority: 5,
          },
          secondaryCanonicalKeys: [],
        },
      },
    });

    expect(view.detectedDocumentEvidence).toEqual([
      'Title and headers read “Validation Report”.',
    ]);
    expect(view.referencedMethods).toEqual([
      { id: "ACM0010", version: "v3.1", role: "REFERENCED_CALCULATION_METHOD", confidence: "high" },
    ]);
  });

  it("normalizes classifier methodology versions for runtime display", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "marcondes-preview.pdf",
      analysis: {
        facts: [],
        parsedEvidenceLabels: ["marcondes-preview.pdf"],
        documentTypes: ["Document"],
        methodologyMentions: ["VM0007", "1.8"],
        extractionConfidence: 0.8,
        warnings: [],
        rawPddText: "Applied Methodology VM0007 REDD+ Methodology Framework 1.8",
      },
      extractionSnapshot: {
        documentType: "Document",
        extractedFacts: [],
        methodologyMentions: ["VM0007"],
        methodologyClassification: {
          primaryMethodology: {
            id: "VM0007",
            version: "1.8",
            role: "PRIMARY_PROJECT_METHODOLOGY",
            confidence: "high",
          },
          monitoringMethodology: null,
          referencedMethods: [],
        },
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 0,
          relevantFactCount: 0,
          methodologyMentionCount: 1,
          warningCount: 0,
        },
        extractionConfidence: 0.8,
        recoveredLocally: false,
      },
      methodologyResolution: {
        status: "none",
        rawMentions: ["VM0007"],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.primaryMethodology?.version).toBe("v1.8");
    expect(view.detectedMethodology).not.toContain(" · v");
  });

  it("merges duplicate methodology ids across primary, monitoring, and referenced rows", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "duplicate-methods.pdf",
      analysis: {
        facts: [],
        parsedEvidenceLabels: ["duplicate-methods.pdf"],
        documentTypes: ["Document"],
        methodologyMentions: ["VM0007", "AMS-II.E"],
        extractionConfidence: 0.8,
        warnings: [],
        rawPddText: "VM0007 Version 1.8 and AMS-II.E version 8",
      },
      extractionSnapshot: {
        documentType: "Document",
        extractedFacts: [],
        methodologyMentions: ["VM0007", "AMS-II.E"],
        methodologyClassification: {
          primaryMethodology: {
            id: "VM0007",
            version: "1.8",
            role: "PRIMARY_PROJECT_METHODOLOGY",
            confidence: "high",
          },
          monitoringMethodology: {
            id: "VM0007",
            version: null,
            role: "MONITORING_METHODOLOGY",
            confidence: "medium",
          },
          referencedMethods: [
            {
              id: "VM0007",
              version: "version 1.8",
              role: "REFERENCED_CALCULATION_METHOD",
              confidence: "high",
            },
            {
              id: "AMS-II.E",
              version: "8",
              role: "REFERENCED_CALCULATION_METHOD",
              confidence: "high",
            },
            {
              id: "AMS-II.E",
              version: null,
              role: "REFERENCED_CALCULATION_METHOD",
              confidence: "medium",
            },
          ],
        },
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 0,
          relevantFactCount: 0,
          methodologyMentionCount: 2,
          warningCount: 0,
        },
        extractionConfidence: 0.8,
        recoveredLocally: false,
      },
      methodologyResolution: {
        status: "none",
        rawMentions: ["VM0007", "AMS-II.E"],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.primaryMethodology).toEqual({
      id: "VM0007",
      version: "v1.8",
      role: "PRIMARY_PROJECT_METHODOLOGY",
      confidence: "high",
    });
    expect(view.monitoringMethodology).toBeUndefined();
    expect(view.referencedMethods).toEqual([
      {
        id: "AMS-II.E",
        version: "v8.0",
        role: "REFERENCED_CALCULATION_METHOD",
        confidence: "high",
      },
    ]);
  });

  it("keeps displayed methodology versions canonical and deduped across fixture-backed previews", () => {
    for (const fixture of loadQuickCheckV2FixtureViews()) {
      const versions = collectDisplayedMethodVersions(fixture.view);
      for (const version of versions) {
        expect(version === null || /^v\d+(?:\.\d+)*$/.test(version)).toBe(true);
      }

      expect(fixture.view.detectedMethodology ?? "").not.toContain(" · v");

      const displayedIds = collectDisplayedMethodIds(fixture.view);
      expect(new Set(displayedIds).size).toBe(displayedIds.length);

      const primaryOrMonitoringIds = new Set(
        [fixture.view.primaryMethodology?.id, fixture.view.monitoringMethodology?.id]
          .filter((value): value is string => Boolean(value)),
      );
      for (const referencedMethod of fixture.view.referencedMethods ?? []) {
        expect(primaryOrMonitoringIds.has(referencedMethod.id)).toBe(false);
      }
    }
  });

  it("uses recovered-signals language and suppresses generic fallback chips", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "monitoring-upload.pdf",
      analysis: {
        facts: [
          {
            id: "project-document",
            category: "project-document",
            summary: "The file appears to be a project document",
            matchText: "project document",
            sourceLabel: "monitoring-upload.pdf",
          },
          {
            id: "reporting-period",
            category: "reporting-period",
            summary: "The file contains an explicit reporting or monitoring period with a date range",
            matchText: "reporting period",
            sourceLabel: "monitoring-upload.pdf",
            detail: "Reporting period: 1 January 2017 to 31 December 2017.",
          },
          {
            id: "monitoring-plan",
            category: "monitoring-plan",
            summary: "The project has a documented monitoring plan",
            matchText: "monitoring plan",
            sourceLabel: "monitoring-upload.pdf",
          },
          {
            id: "mapped-area",
            category: "mapped-area",
            summary: "The file includes a mapped project area",
            matchText: "mapped project area",
            sourceLabel: "monitoring-upload.pdf",
          },
        ],
        parsedEvidenceLabels: ["monitoring-upload.pdf"],
        documentTypes: ["Document"],
        documentClassification: {
          documentClass: "monitoring_report",
          confidence: 0.99,
          evidence: ['page 1 title: "Monitoring Report"'],
          secondaryCandidates: [],
          warnings: [],
        },
        methodologyMentions: [],
        extractionConfidence: 0.52,
        warnings: [
          "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.",
        ],
        rawPddText: "Monitoring Report. Reporting period and mapped project area are mentioned.",
      },
      methodologyResolution: {
        status: "none",
        rawMentions: [],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.signalsTitle).toBe("Recovered signals");
    expect(view.signals.map((signal) => signal.label)).toEqual(["Monitoring Report", "Reporting period", "Mapped project area"]);
    expect(view.signalSummary).toBe("Recovered signals suggest this is a monitoring report and mention reporting period and mapped project area.");
  });

  it("shows a warning and fallback labels when methodology is not confidently detected", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "review-upload.pdf",
      analysis: {
        facts: [
          {
            id: "boundary",
            category: "boundary",
            summary: "The project boundary is described in the PDD",
            matchText: "project boundary described",
            sourceLabel: "review-upload.pdf",
          },
        ],
        parsedEvidenceLabels: ["review-upload.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: [],
        extractionConfidence: 0.34,
        warnings: [],
        rawPddText: "Boundary description and mapped project area are included in the uploaded file.",
      },
      methodologyResolution: {
        status: "none",
        rawMentions: [],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.detectedDocumentType).toBe("Carbon Document (unclassified)");
    expect(view.detectedMethodology).toBe("Not confidently detected");
    expect(view.methodologyConfidence).toBe("unknown");
    expect(view.warning).toBe("Methodology was not confidently detected. Matches below may need review.");
    expect(view.signals.map((signal) => signal.label)).toEqual(["Project boundary"]);
  });

  it("only renders chips supported by the uploaded file facts", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "boundary-note.pdf",
      analysis: {
        facts: [
          {
            id: "boundary",
            category: "boundary",
            summary: "The project boundary is described in the PDD",
            matchText: "project boundary described",
            sourceLabel: "boundary-note.pdf",
            detail: "Boundary description: project boundary follows the watershed edge.",
          },
          {
            id: "monitoring-evidence",
            category: "monitoring-evidence",
            summary: "The project has documented monitoring evidence",
            matchText: "documented monitoring evidence",
            sourceLabel: "boundary-note.pdf",
          },
        ],
        parsedEvidenceLabels: ["boundary-note.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: [],
        extractionConfidence: 0.52,
        warnings: [],
        rawPddText: "Boundary description: project boundary follows the watershed edge.",
      },
      methodologyResolution: {
        status: "none",
        rawMentions: [],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.signals.map((signal) => signal.label)).toEqual(["Project boundary"]);
  });

  it("detects project document type and methodology from recovered fallback text", () => {
    const rawPddText = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/rimba-raya-fallback.txt"), "utf8");
    const view = buildExtractionPreviewViewModel({
      fileName: "Rimba_Raya_Project_Document.pdf",
      analysis: {
        facts: [
          {
            id: "project-document",
            category: "project-document",
            summary: "The file identifies itself as a project document",
            matchText: "project document identified",
            sourceLabel: "Rimba_Raya_Project_Document.pdf",
          },
          {
            id: "baseline-scenario",
            category: "baseline-scenario",
            summary: "The file describes the baseline scenario",
            matchText: "baseline scenario described",
            sourceLabel: "Rimba_Raya_Project_Document.pdf",
          },
          {
            id: "stakeholder-consultation",
            category: "stakeholder-consultation",
            summary: "The file records stakeholder consultation",
            matchText: "stakeholder consultation documented",
            sourceLabel: "Rimba_Raya_Project_Document.pdf",
          },
          {
            id: "leakage",
            category: "leakage",
            summary: "The file discusses leakage",
            matchText: "leakage discussed",
            sourceLabel: "Rimba_Raya_Project_Document.pdf",
          },
        ],
        parsedEvidenceLabels: ["Rimba_Raya_Project_Document.pdf"],
        documentTypes: ["Document"],
        methodologyMentions: ["VM0004"],
        extractionConfidence: 0.68,
        warnings: [
          "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.",
        ],
        rawPddText,
      },
      methodologyResolution: {
        status: "none",
        rawMentions: ["VM0004"],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.detectedDocumentType).toBe("Project Description / PD");
    expect(view.detectedMethodology).toBe("VM0004 v1.0");
    expect(view.warning).toBe(
      "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.",
    );
    expect(view.signalsTitle).toBe("Recovered signals");
    expect(view.signals.map((signal) => signal.label)).toEqual([
      "Project Description / PD",
      "Baseline scenario",
      "Stakeholder consultation",
    ]);
  });

  it("shows the weak recovered-text summary when no strong signals are found", () => {
    const view = buildExtractionPreviewViewModel({
      fileName: "weak-unknown.pdf",
      analysis: {
        facts: [],
        parsedEvidenceLabels: ["weak-unknown.pdf"],
        documentTypes: ["Document"],
        methodologyMentions: [],
        extractionConfidence: 0.22,
        warnings: [],
        rawPddText: fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/weak-unknown-fallback.txt"), "utf8"),
      },
      methodologyResolution: {
        status: "none",
        rawMentions: [],
        programSignals: [],
        signals: [],
        matchedMethods: [],
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      },
    });

    expect(view.signals).toEqual([]);
    expect(view.signalSummary).toBe(
      "No strong document signals found yet. Open extraction details to inspect parsed text.",
    );
    expect(view.detectedDocumentType).toBe("Carbon Document (unclassified)");
    expect(view.detectedMethodology).toBe("Not confidently detected");
  });

  it("normalizes a preliminary match result", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: ["The project has documented monitoring evidence"],
        methodologyMentions: ["AR-ACM0003"],
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 1,
          relevantFactCount: 1,
          methodologyMentionCount: 1,
          warningCount: 0,
        },
        extractionConfidence: 0.82,
        recoveredLocally: false,
      },
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: {
        id: "quick-result-1",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Monitoring frequency",
        verdict: "Supported",
        explanation: "All expected evidence is linked.",
        citations: ["Section 10"],
        nextStepHint: "Open full review.",
        matchConfidence: 0.84,
        unresolved: ["Quick Check is preliminary."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.sourceMode).toBe("uploaded_file");
    expect(view.match?.methodologyCode).toBe("AR-ACM0003");
    expect(view.match?.unresolved).toEqual(["Quick Check is preliminary."]);
    expect(view.match?.grounding).toBe("methodology_grounded");
    expect(view.extractionState.value).toBe("grounded");
    expect(view.supportStrength.value).toBe("strong_evidence_match");
    expect(view.supportStrength.label).toBe("Strong evidence match");
  });

  it("fails safely when extraction facts are missing", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "Unsupported claim",
      evidenceFileName: "opaque-scan.pdf",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: [],
        methodologyMentions: [],
        warnings: ["We couldn't extract usable text from this file yet."],
        signals: {
          parsedEvidenceCount: 0,
          factCount: 0,
          relevantFactCount: 0,
          methodologyMentionCount: 0,
          warningCount: 1,
        },
      },
      result: null,
    });

    expect(view.status).toBe("extraction_failed");
    expect(view.match).toBeNull();
    expect(view.extractionState.value).toBe("weak");
    expect(view.supportStrength.value).toBe("needs_review");
  });

  it("marks a specific rule as a catalog candidate when methodology grounding is absent", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "kenya-second-check-evidence.pdf",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: [
          "The file contains an explicit reporting or monitoring period with a date range",
          "The project has documented monitoring evidence",
        ],
        methodologyMentions: [],
        warnings: ["No methodology mentions were detected in the uploaded evidence."],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 3,
          relevantFactCount: 2,
          methodologyMentionCount: 0,
          warningCount: 1,
        },
      },
      methodologyCode: "AR-AM0014",
      methodologyVersion: "v03-0",
      result: {
        id: "quick-result-kenya",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0008",
        requirementLabel: "R-1-0008 · Monitoring report consolidation",
        verdict: "Supported",
        explanation: "Evidence is semantically similar to the current catalog rule, but no methodology text was detected.",
        citations: [],
        nextStepHint: "Open full review.",
        unresolved: ["No methodology mentions were detected in the uploaded evidence."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.match?.grounding).toBe("catalog_candidate");
    expect(view.extractionState.value).toBe("partial");
    expect(view.supportStrength.value).toBe("needs_review");
  });

  it("marks extraction as partial when facts exist but signals are incomplete", () => {
    const state = deriveQuickCheckExtractionState({
      documentType: "Workbook",
      extractedFacts: ["The workbook contains monitoring records"],
      methodologyMentions: [],
      warnings: ["No methodology mentions were detected in the uploaded evidence."],
      signals: {
        parsedEvidenceCount: 1,
        factCount: 2,
        relevantFactCount: 1,
        methodologyMentionCount: 0,
        warningCount: 1,
      },
    });

    expect(state.value).toBe("partial");
  });

  it("keeps methodology-grounded but ambiguous extraction in needs-review state", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: ["The project has documented monitoring evidence"],
        methodologyMentions: ["AR-ACM0003"],
        warnings: ["The extraction found relevant facts, but the signal is still incomplete."],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 1,
          relevantFactCount: 1,
          methodologyMentionCount: 1,
          warningCount: 1,
        },
      },
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: {
        id: "quick-result-2",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Monitoring frequency",
        verdict: "Supported",
        explanation: "A requirement match exists, but the evidence signal is incomplete.",
        citations: ["Section 10"],
        nextStepHint: "Open full review.",
        matchConfidence: 0.72,
        unresolved: ["Quick Check is preliminary."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.match?.grounding).toBe("methodology_grounded");
    expect(view.extractionState.value).toBe("partial");
    expect(view.supportStrength.value).toBe("needs_review");
    expect(view.supportStrength.label).toBe("Needs review");
  });

  it("does not promote a grounded preliminary match to strong when the verdict is not supported", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: ["The project has documented monitoring evidence"],
        methodologyMentions: ["AR-ACM0003"],
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 1,
          relevantFactCount: 1,
          methodologyMentionCount: 1,
          warningCount: 0,
        },
        extractionConfidence: 0.82,
        recoveredLocally: false,
      },
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: {
        id: "quick-result-3",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Monitoring frequency",
        verdict: "Needs review",
        explanation: "A preliminary requirement match exists, but the reconciliation verdict is not supported.",
        citations: ["Section 10"],
        nextStepHint: "Open full review.",
        matchConfidence: 0.72,
        unresolved: ["Quick Check is preliminary."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.match?.grounding).toBe("methodology_grounded");
    expect(view.extractionState.value).toBe("grounded");
    expect(view.supportStrength.value).toBe("needs_review");
    expect(view.supportStrength.label).toBe("Needs review");
  });
});
