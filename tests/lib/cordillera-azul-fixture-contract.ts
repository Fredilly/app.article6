/**
 * Cordillera Azul Reliability Fixture Contract
 *
 * Four fixture objects encoding the exact signal resolution expectations for
 * the Cordillera Azul National Park REDD project document family.
 *
 * IMPORTANT:
 *   - Strict-eval eligible only after parser extraction depth and page
 *     provenance can support gold expectations.
 *   - The Monitoring Report fixture is marked parser_fixture_blocked_by_payload_limit
 *     until the pdf-extract endpoint handles 9MB+ documents.
 *
 * Each fixture is a manifest entry matching the schema contract from
 * src/lib/chat/quickCheckEvidence.ts types:
 *   QuickCheckExtractionSnapshot, QuickCheckResult, MethodologySignalResult.
 */

export const cordilleraAzulFixtures = [
  // ─── Fixture 1: CCB Validation Report ─────────────────────────────────
  //
  // Source: doc_0bd5d5d439f5_CCB_ValidationReport_V3-1_021913.pdf
  // Page count: ~44
  // Document kind: validation_report
  // Document family: CCBA/CCB (Climate, Community & Biodiversity Alliance)
  //
  // Key signal rule:
  //   VM0007 appears 11 times as supporting carbon-accounting evidence
  //   (joint assessment under VCS, carbon quantification reference).
  //   The governing standard is CCBA Standards Second Edition.
  //   CCB has no ingested methodology pack, so CCB is treated as
  //   standard/document family, not as methodology.
  //
  //
  //   CCB is NOT a Verra/VCS program family. It must have its own
  //   documentFamily ("CCBA/CCB") and program signal.
  //
  // Expected resolver behavior:
  //   mustResolvePrimaryMethodology: false  (no VCS methodology is primary)
  //   expectedPrimaryMethodology: null
  //   mustNotResolvePrimaryMethodology: ["VM0007"]
  //   expectedDocumentFamily: "CCBA/CCB"
  //
  {
    fixtureId: "cordillera-azul-ccb-validation-2013",
    sourceFile: "doc_0bd5d5d439f5_CCB_ValidationReport_V3-1_021913.pdf",
    pageCount: 44,
    documentKind: "validation_report",
    documentFamily: "CCBA/CCB",
    standardSignals: [
      {
        standard: "CCBA Standards Second Edition",
        role: "governing_standard",
        page: 1,
        quote:
          "This report presents the findings of an assessment conducted by SCS Global Services (SCS), to confirm the claim that the Cordillera Azul National Park REDD Project (\"the Project\") conforms to the Climate, Community and Biodiversity Project Design Standards (Second Edition) at the Gold level.",
        whyThisRole:
          "The report's opening paragraph establishes CCBA Standards as the governing criteria. The report structure (Sections G1-G5, CL1-CL3, CM1-CM3, B1-B3, GL1-GL3) follows the CCBA template. The conclusion (Section 4.0) issues a 'CCB Validation Conclusion'.",
      },
      {
        standard: "VCS",
        role: "referenced_standard",
        page: 4,
        quote:
          "This review was continued during the site visit (22 October – 6 November 2012), during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007.",
        whyThisRole:
          "VCS is mentioned only as an adjacent program where a joint assessment was conducted. The CCB validation itself does not validate against VCS criteria.",
      },
    ],
    methodologySignals: [
      {
        methodologyId: "VM0007",
        version: null,
        role: "supporting_carbon_accounting_reference",
        page: 4,
        quote:
          "This review was continued during the site visit (22 October – 6 November 2012), during a joint assessment under the Verified Carbon Standard and the REDD methodology VM0007.",
        whyThisRole:
          "VM0007 is mentioned as the methodology used under VCS for the joint assessment. The CCB validation does not evaluate the project against VM0007 criteria. VM0007 is supporting carbon-accounting evidence referenced in the report.",
      },
      {
        methodologyId: "VM0007",
        version: null,
        role: "supporting_carbon_accounting_reference",
        page: 37,
        quote:
          "on a per hectare basis for each forest type using the VCS VM0007 methodology. While a few deviations from the methodology were detected, all variations...",
        whyThisRole:
          "Appendix reference to VM0007 for carbon quantification methods. Supporting evidence for how carbon stocks were calculated, not central to the CCB validation conclusion.",
      },
    ],
    expectedResolverBehavior: {
      mustResolvePrimaryMethodology: false,
      expectedPrimaryMethodology: null,
      mustNotResolvePrimaryMethodology: ["VM0007"],
      expectedDocumentFamily: "CCBA/CCB",
    },
    negativeAssertions: [
      "resolveMethodologySignals must NOT return exactlyOne=true for VM0007",
      "gatingMethodCodes must NOT return [\"VM0007\"]",
      "documentFamily must NOT be 'VCS' or 'Verra'",
      "CCB program signal must NOT collapse into Verra program family",
    ],
    positiveAssertions: [
      "documentType should be 'Validation Report'",
      "methodologyMentions should include VM0007 but gating must not trigger",
      "detectedPrograms should include CCBA/CCB as its own family",
      "CCBA Standards Second Edition should be detectable as the governing framework",
    ],
    provenanceAssertions: [
      "Any methodology answer must cite page 4 context, not page 1 header or ToC",
      "Quote anchor must include 'joint assessment' context for VM0007",
      "Governance answer must cite page 1 'conforms to Climate Community and Biodiversity Project Design Standards'",
    ],
    strictEvalEligible: false,
    blockedBy: [
      "parser_extraction_depth: only first ~3 pages extracted from a 44-page document",
      "no_document_family_field: documentFamily context doesn't exist in resolver yet",
      "no_provenance_tracking: page numbers and quote anchors not supported in extraction signals",
      "ccb_collapsed_into_verra: PROGRAM_SIGNALS maps CCB to Verra incorrectly",
    ],
  },

  // ─── Fixture 2: VCS Validation Report ─────────────────────────────────
  //
  // Source: doc_1a31ffead659_VCS_ValidationReport_020113.pdf
  // Page count: 47
  // Document kind: validation_report
  // Document family: VCS
  //
  // Key signal rule:
  //   VM0007 v1.3 is the primary_applied methodology.
  //   The report validates AGAINST VCS Version 3.3.
  //   Evidence must come from the Summary/Objective sections,
  //   not generic header or TOC text.
  //
  {
    fixtureId: "cordillera-azul-vcs-validation-2013",
    sourceFile: "doc_1a31ffead659_VCS_ValidationReport_020113.pdf",
    pageCount: 47,
    documentKind: "validation_report",
    documentFamily: "VCS",
    standardSignals: [
      {
        standard: "Verified Carbon Standard (VCS) Version 3.3",
        role: "governing_standard",
        page: 2,
        quote:
          "This report documents the validation of the Cordillera Azul National Park REDD Project against the Verified Carbon Standard version 3.3 and its supporting documents, including the approved methodology VM0007 version 1.3, \"REDD Methodology Modules.\"",
        whyThisRole:
          "The report's Summary paragraph explicitly states the report validates AGAINST VCS v3.3. The conclusion (page 2) confirms conformance: 'correctly applies the selected methodology element and is in conformance with all applicable requirements of the Verified Carbon Standard (VCS)'.",
      },
    ],
    methodologySignals: [
      {
        methodologyId: "VM0007",
        version: "v1.3",
        role: "primary_applied",
        page: 2,
        quote:
          "including the approved methodology VM0007 version 1.3, \"REDD Methodology Modules.\"",
        whyThisRole:
          "VM0007 v1.3 is listed as the approved methodology being validated. The project 'correctly applies the selected methodology element'. The version (v1.3) is critical provenance.",
      },
      {
        methodologyId: "VM0007",
        version: "v1.3",
        role: "primary_applied",
        page: 2,
        quote:
          "The Project correctly applies the selected methodology element and is in conformance with all applicable requirements of the Verified Carbon Standard (VCS).",
        whyThisRole:
          "The formal validation conclusion confirms VM0007 is the applied methodology.",
      },
      {
        methodologyId: "VM0007",
        version: null,
        role: "primary_applied",
        page: 6,
        quote:
          "approved methodology VM0007, and that they are indeed planned and appropriate for the project circumstances",
        whyThisRole:
          "Methodology reference within the Detailed Requirements section confirming VM0007 scope.",
      },
    ],
    expectedResolverBehavior: {
      mustResolvePrimaryMethodology: true,
      expectedPrimaryMethodology: "VM0007",
      mustNotResolvePrimaryMethodology: [],
      expectedDocumentFamily: "VCS",
    },
    negativeAssertions: [
      "must NOT resolve CCB as governing standard",
      "must NOT lose VM0007 version (v1.3) in methodology answer",
      "methodology answer must NOT be based solely on page 1 header or ToC",
    ],
    positiveAssertions: [
      "VM0007 must resolve as exactlyOne primary methodology",
      "gatingMethodCodes must return [\"VM0007\"]",
      "detectedPrograms must include VCS/Verra",
      "methodology answer should cite page 2 summary paragraph",
    ],
    provenanceAssertions: [
      "Methodology answer must include version: v1.3",
      "Quote anchor must include 'approved methodology VM0007 version 1.3'",
      "Governance answer must cite 'Verified Carbon Standard version 3.3' from page 2 Summary",
    ],
    strictEvalEligible: false,
    blockedBy: [
      "parser_extraction_depth: only ~2 pages extracted from 47-page report",
      "version_information_lost: resolver normalizes VM0007, dropping v1.3",
      "no_provenance_tracking: page numbers and quote anchors not supported",
    ],
  },

  // ─── Fixture 3: Project Description Document (PDD) ────────────────────
  //
  // Source: doc_177895326a9e_PROJ_DESC_985_20DEC2012.pdf
  // Page count: 198
  // Document kind: project_description
  // Document family: project_description (dual VCS + CCB)
  //
  // Key signal rules:
  //   VM0007 is applied_in_project methodology (not validation).
  //   Dual standard signals (VCS + CCB) must be preserved.
  //   TOC mentions are NOT sufficient evidence.
  //   The first body mention of VM0007 is around line 415
  //   (Section 1.x, not ToC), confirmed at Section 2.1 (~line 3100).
  //
  {
    fixtureId: "cordillera-azul-pdd-2012",
    sourceFile: "doc_177895326a9e_PROJ_DESC_985_20DEC2012.pdf",
    pageCount: 198,
    documentKind: "project_description",
    documentFamily: "project_description",
    standardSignals: [
      {
        standard: "Verified Carbon Standard (VCS)",
        role: "governing_standard",
        page: 5,
        quote:
          "Two protocols were identified to develop and monitor the project: Verified Carbon Standard (VCS) and the Community, Climate and Biodiversity (CCB) protocol. Under VCS, the project is using VM0007 REDD Methodology Modules (REDD-MF) for unplanned frontier deforestation for carbon stock and avoided emissions assessment.",
        whyThisRole:
          "The PDD explicitly names both VCS and CCB as governing standards. VCS provides the carbon accounting framework; CCB provides the community and biodiversity criteria.",
      },
      {
        standard: "CCB Standards Second Edition / CCBA",
        role: "secondary_standard",
        page: 5,
        quote:
          "Two protocols were identified to develop and monitor the project: Verified Carbon Standard (VCS) and the Community, Climate and Biodiversity (CCB) protocol.",
        whyThisRole:
          "CCB is explicitly named as a governing standard alongside VCS. Section headings throughout the PDD include CCB tag references (e.g., 'CCB: G3.4, G3.7').",
      },
    ],
    methodologySignals: [
      {
        methodologyId: "VM0007",
        version: null,
        role: "applied_in_project",
        page: 5,
        quote:
          "Under VCS, the project is using VM0007 REDD Methodology Modules (REDD-MF) for unplanned frontier deforestation for carbon stock and avoided emissions assessment.",
        whyThisRole:
          "First body occurrence (line 415). Establishes that VM0007 REDD-MF is the methodology the project applies under VCS. This is the project_description context (not validation).",
      },
      {
        methodologyId: "VM0007",
        version: "v1.3",
        role: "applied_in_project",
        page: 70,
        quote:
          "The methodology used to quantify the avoided emissions is the framework and component modules of the modular REDD methodology VM0007 REDD Methodology Modules, Version 1.3 approved 20 November 2012.",
        whyThisRole:
          "Section 2.1 'Title and Reference of Methodology' formally documents the methodology version and approval date. This is the canonical methodology reference in the PDD.",
      },
    ],
    expectedResolverBehavior: {
      mustResolvePrimaryMethodology: true,
      expectedPrimaryMethodology: "VM0007",
      mustNotResolvePrimaryMethodology: [],
      expectedDocumentFamily: "project_description",
    },
    negativeAssertions: [
      "Must NOT collapse dual VCS+CCB signals into single 'Verra' program bucket",
      "Must NOT cite ToC line 'Sectoral Scope and Project Type' as methodology evidence",
      "Methodology answer must NOT be based solely on page 1 header text or filename",
    ],
    positiveAssertions: [
      "VM0007 must be detected as applied methodology",
      "Both VCS and CCB must appear in detectedPrograms with distinct identities",
      "SDual standard project must not force a single program family",
      "Methodology answer should cite Section 2.1 (page ~70) or Section 1 project description (page ~5)",
    ],
    provenanceAssertions: [
      "Methodology answer must cite page 5 (first body mention) or page ~70 (Section 2.1 Title and Reference)",
      "Quote anchor must include 'project is using VM0007 REDD Methodology Modules' (page 5)",
      "OR: quote anchor must include 'VM0007 REDD Methodology Modules, Version 1.3' (Section 2.1)",
      "Dual standard answer must include both VCS and CCB citations from page 5",
    ],
    strictEvalEligible: false,
    blockedBy: [
      "parser_payload_limit: 12MB PDF returns 413 PAYLOAD TOO LARGE — 0 pages extracted",
      "local_recovery_too_weak: browser-side recovery can't extract methodology mentions from raw PDF bytes",
      "no_document_family_field: documentFamily context doesn't exist in resolver yet",
      "no_dual_standard_support: VCS+CCB both map to Verra program — cannot distinguish or preserve both",
      "no_provenance_tracking: page numbers and quote anchors not supported in extraction signals",
    ],
  },

  // ─── Fixture 4: Monitoring Report ─────────────────────────────────────
  //
  // Source: doc_7839a149da9a_MONIT_REP_985_08AUG2016_07AUG2018.pdf
  // Page count: 184 (verified: pdfinfo reports 184)
  // File size: 9.0 MB (9,387,783 bytes)
  // Document kind: monitoring_report
  // Document family: project_monitoring (dual VCS + CCB)
  //
  // First-page title: "MONITORING REPORT: CCB Version 2, VCS Version 3"
  // Project: "Cordillera Azul National Park REDD+ Project" (note REDD+)
  // Project ID: 985
  // Reporting period: "August 8, 2016 to August 7, 2018"
  // Crediting period: "20 years, extending from 8 August 2008 to 7 August 2028"
  // Methodology: "VM0007 REDD Methodology Modules Version 1.3"
  //   (Section "Title and Reference of Methodology" in body)
  // CCB mentions: 378  VCS mentions: 380  CCBA: 3
  //
  // Self-verification (Hermes):
  //   File accessible: YES
  //   Page count verified: 184 (via pdfinfo)
  //   First-page title verified: "MONITORING REPORT: CCB Version 2, VCS Version 3"
  //   Document family verified: dual VCS+CCB monitoring report
  //   Methodology evidence verified: VM0007 REDD Methodology Modules Version 1.3
  //   Reporting period verified: "August 8, 2016 to August 7, 2018"
  //   Extraction on live Quick Check: FAILED (413 PAYLOAD TOO LARGE)
  //
  {
    fixtureId: "cordillera-azul-monitoring-985-2016-2018",
    sourceFile: "doc_7839a149da9a_MONIT_REP_985_08AUG2016_07AUG2018.pdf",
    pageCount: 184,
    documentKind: "monitoring_report",
    documentFamily: "project_monitoring",
    standardSignals: [
      {
        standard: "VCS Version 3.4",
        role: "governing_standard",
        page: 1,
        quote: "MONITORING REPORT: CCB Version 2, VCS Version 3",
        whyThisRole:
          "The document header identifies both CCB v2.0 and VCS v3.4 as governing frameworks for this monitoring report. VCS provides the carbon accounting framework.",
      },
      {
        standard: "CCB Version 2.0",
        role: "secondary_standard",
        page: 1,
        quote: "MONITORING REPORT: CCB Version 2, VCS Version 3",
        whyThisRole:
          "CCB is explicitly listed in the document header alongside VCS. The report tracks community and biodiversity indicators per CCB requirements.",
      },
    ],
    methodologySignals: [
      {
        methodologyId: "VM0007",
        version: "v1.3",
        role: "applied_in_project",
        page: 30,
        quote:
          "The methodology used to quantify the avoided emissions is the framework and component modules of the modular REDD methodology VM0007 REDD Methodology Modules, Version 1.3 approved 20 November 2012.",
        whyThisRole:
          "The monitoring report's Section 'Title and Reference of Methodology' confirms VM0007 v1.3 is the applied carbon accounting methodology. This matches the PDD and VCS validation report.",
      },
      {
        methodologyId: "VM0007",
        version: "v1.3",
        role: "applied_in_project",
        page: 30,
        quote:
          "VM0007 REDD Methodology Module, REDD Methodology Framework (REDD-MF), version 1.3",
        whyThisRole:
          "The specific REDD-MF module of VM0007 is named. This is the framework under which monitoring is conducted.",
      },
    ],
    expectedResolverBehavior: {
      mustResolvePrimaryMethodology: true,
      expectedPrimaryMethodology: "VM0007",
      mustNotResolvePrimaryMethodology: [],
      expectedDocumentFamily: "project_monitoring",
    },
    negativeAssertions: [
      "Must NOT collapse dual VCS+CCB into single Verra program",
      "Must NOT cite filename '985' or 'MONIT_REP' as methodology evidence",
      "Methodology answer must NOT be based solely on header text",
    ],
    positiveAssertions: [
      "VM0007 must be detected as applied methodology",
      "Both VCS and CCB must appear with distinct identities (not collapsed into Verra)",
      "Reporting period 'August 8, 2016 to August 7, 2018' should be extractable",
      "Project title should include REDD+ (Cordillera Azul National Park REDD+ Project)",
      "Project ID 985 should be extractable from document metadata",
    ],
    provenanceAssertions: [
      "Methodology answer must cite page ~30 Title and Reference of Methodology section",
      "Quote anchor must include 'VM0007 REDD Methodology Modules, Version 1.3'",
      "Monitoring period answer must include 'August 8, 2016 to August 7, 2018'",
      "Crediting period answer must include '20 years, extending from 8 August 2008 to 7 August 2028'",
    ],
    strictEvalEligible: false,
    blockedBy: [
      "parser_payload_limit: 9MB PDF returns 413 PAYLOAD TOO LARGE — 0 pages extracted on live Quick Check",
      "local_recovery_too_weak: browser-side recovery can't extract methodology, dates, or project facts",
      "no_dual_standard_support: VCS+CCB both map to Verra program in current code",
      "no_provenance_tracking: page numbers and quote anchors not supported",
      "self_verified_by_hermes: file accessible, metadata confirmed, methodology evidence found",
    ],
  },
];
