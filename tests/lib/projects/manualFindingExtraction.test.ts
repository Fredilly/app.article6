import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { extractManualFindingDraftsFromPages } from '@/lib/projects/manualFindingExtraction';

function loadFixturePages() {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/projects/vcs1530-appendix1-sample.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    pages: Array<{ pageNumber: number; text: string }>;
  };
  return fixture.pages;
}

function loadCcb1530AppendixPages() {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/projects/ccb1530-appendix1-pages.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    pages: Array<{ pageNumber: number; text: string }>;
  };
  return fixture.pages;
}

function loadCcb1530ExpectedRegister() {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/projects/ccb1530-appendix1-expected.json');
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    sourceDocumentName: string;
    expectedFindingCount: number;
    findings: Array<{
      findingId: string;
      findingType: 'CAR' | 'CL' | 'FAR';
      sourcePageRange: string;
      closureStatus: 'open' | 'closed';
      hasRequirement: boolean;
      hasDescription: boolean;
      hasProjectResponse: boolean;
      hasDocumentationSubmitted: boolean;
      hasAuditTeamEvaluation: boolean;
    }>;
  };
}

describe('manual finding extraction', () => {
  it('extracts CAR findings across page breaks with page ranges', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: loadFixturePages(),
      sourceDocumentName: 'VCS-1530-verification-report.pdf',
    });

    const finding = result.drafts.find((draft) => draft.findingId === 'CAR01');
    expect(finding).toBeDefined();
    expect(finding?.findingType).toBe('CAR');
    expect(finding?.sourcePageRange).toBe('118-119');
    expect(finding?.requirement).toContain('monitoring period activity data');
    expect(finding?.description).toContain('does not reconcile');
    expect(finding?.documentationSubmitted).toContain('workbook extract');
    expect(finding?.projectResponse).toContain('revised workbook');
    expect(finding?.auditTeamEvaluation).toContain('report narrative still needs');
    expect(finding?.closureStatus).toBe('open');
  });

  it('extracts CL and FAR findings', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: loadFixturePages(),
      sourceDocumentName: 'VCS-1530-verification-report.pdf',
    });

    expect(result.drafts.find((draft) => draft.findingId === 'CL02')).toEqual(
      expect.objectContaining({
        findingType: 'CL',
        closureStatus: 'closed',
      }),
    );
    expect(result.drafts.find((draft) => draft.findingId === 'FAR03')).toEqual(
      expect.objectContaining({
        findingType: 'FAR',
        closureStatus: 'open',
      }),
    );
  });

  it('extracts F-001 style findings from real-world table sections and marks uncertain types as needs review', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 142,
          text: 'Appendix 1 Findings table\nF-001\nDescription: The verification report references community training logs that were not included in the submitted evidence package.\nProject response: The project proponent stated that the missing logs will be added to the next submission.\nClosure status: Open',
        },
      ],
      sourceDocumentName: 'VCS-1530-CCB-verification-report.pdf',
    });

    expect(result.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'F-001',
          extractionStatus: 'needs-review',
          closureStatus: 'open',
        }),
      ]),
    );
  });

  it('maps generic finding ids to CAR/CL/FAR when a nearby full label makes the type clear', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 150,
          text: 'Corrective Action Request\nF-002\nDescription: The monitoring report omitted one annex reference.\nProject response: A revised annex reference list was submitted.\nClosure status: Closed',
        },
      ],
      sourceDocumentName: 'typed-finding.pdf',
    });

    expect(result.drafts[0]).toEqual(
      expect.objectContaining({
        findingId: 'F-002',
        findingType: 'CAR',
        closureStatus: 'closed',
      }),
    );
  });

  it('extracts explicit "No." finding labels used in VVB reports', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 40,
          text: 'APPENDIX 1\nCAR No. 01 Requirement:\n3.1\nDescription of the CAR\nA monitoring discrepancy was identified.\nResponse from the project developer Date: 17-05-2021\nA corrected workbook was submitted.\nDocumentation submitted by the project developer\nCorrected workbook\nEvaluation of the audit team Date: 23-05-2021\nThe correction resolves the issue.\nCAR Closed\nCL No. 02 Requirement\n2.4\nDescription of the CL\nClarify the evidence path.\nResponse from the project developer Date: 17-05-2021\nThe path was clarified.\nCL Closed\nFAR No. 03 Requirement:\n6.2\nDescription of the FAR\nContinue monitoring invasive behavior.\nResponse from the project developer Date: 17-05-2021\nThis will be addressed next period.\nFAR Open',
        },
      ],
      sourceDocumentName: 'vvb-report.pdf',
    });

    expect(result.drafts.map((draft) => draft.findingId)).toEqual(['CAR01', 'CL02', 'FAR03']);
    expect(result.drafts.map((draft) => draft.findingType)).toEqual(['CAR', 'CL', 'FAR']);
    expect(result.drafts[0]).toEqual(expect.objectContaining({
      requirement: '3.1',
      description: 'A monitoring discrepancy was identified.',
      projectResponse: 'A corrected workbook was submitted.',
      documentationSubmitted: 'Corrected workbook',
      auditTeamEvaluation: 'The correction resolves the issue.',
      closureStatus: 'closed',
    }));
  });

  it('extracts table-style CAR01 fields from the real appendix format', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 40,
          text: 'CAR No. 01 Requirement:\nCCB V3.1: G1.10\nand G1.11. G3.1,\nG3.2 G3.3, G3.4,\nG3.5, G3.6, G5.1,\nG5.2, G5.3 and\nG5.6. CM 1, CM2,\nCM3 and CM4. B1,\nB2, B3 and B4.\nCL3.\nCCB Date: 25-04-2021\nDescription of the CAR\nCompliance with Environmental Safeguards, including Climate, Community and Biodiversity Standards (CCB),\nis not ensured.\nResponse from the project developer Date: 17-05-2021\nThe Participation, Communication and Appropriation Strategy in the project of Initiatives of commercial forest\nplantations, was carried out following the safeguards regarding.\nDocumentation submitted by the project developer\nEPCAP requirements\nEvaluation of the audit team Date: 23-05-2021',
        },
        {
          pageNumber: 41,
          text: 'CCB & VCS VERIFICATION REPORT:\nCCB Version 3, VCS Version 3\nCCB v3.0, VCS v3.4 41\nThe project proponent has provided all the supports that demonstrate compliance with environmental\nsafeguards, complying with the CCB standard.\nCAR Closed\nCAR No. 02 Requirement:\n3.6',
        },
      ],
      sourceDocumentName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
    });

    expect(result.drafts.find((draft) => draft.findingId === 'CAR01')).toEqual(
      expect.objectContaining({
        findingType: 'CAR',
        sourcePageRange: '40-41',
        requirement: expect.stringContaining('CCB V3.1'),
        description: expect.stringContaining('Compliance with Environmental Safeguards'),
        projectResponse: expect.stringContaining('Participation, Communication and Appropriation Strategy'),
        documentationSubmitted: 'EPCAP requirements',
        auditTeamEvaluation: expect.stringContaining('project proponent has provided all the supports'),
        closureStatus: 'closed',
      }),
    );
  });

  it('stops FAR05 at the next appendix and preserves open FAR statuses', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 48,
          text: 'FAR No. 01 Requirement:\n6.2 - 23\nAR-ACM0003 Date: 25-04-2021\nDescription of the FAR\nCompliance with the monitoring procedure is not ensured.\nResponse from the project developer Date: 17-05-2021\nSilvicultural management activities were performed.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021\nRecommendation remains for the next period.\nFAR Open\nFAR No. 02 Requirement:\nG. 3\nCCB V3.1 Date: 25-04-2021',
        },
        {
          pageNumber: 49,
          text: 'Description of the FAR\nCompliance with environmental safeguards is not ensured.\nResponse from the project developer Date: 17-05-2021\nCommunity outreach will continue.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021\nThe project proponents will continue the communication process.\nFAR open\nFAR No. 03 Requirement:\n3.1.3\nCCB _ VCS Date: 25-04-2021\nDescription of the FAR\nTo give clarity with the monitoring and verification of the plots, individual marking in the field is necessary.\nResponse from the project developer Date: 17-05-2021\nThis request will be considered for a future verification.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021',
        },
        {
          pageNumber: 50,
          text: 'The project proponent will consider the durable marking of the plots for the next verifications.\nFAR Open\nFAR No. 05 Requirement:\n3.2.21(6)\nVCS Standard Date: 12-04-2022\nDescription of the FAR\nAssess if the managed species are exhibiting invasive behavior and if the management plan for mitigating the spread is being successfully implemented during each verification period.\nResponse from the project developer Date: 13-04-2022\nThe project proponent will conduct an evaluation at each verification.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 13-04-2022\nFAR open\nAPPENDIX 2: AUDIT PLAN\nVerification Report “Grouped project for commercial forest plantations initiatives in the department of Vichada”.',
        },
        {
          pageNumber: 51,
          text: 'Audit plan content that must not be captured into FAR05.\nTipo de auditoria Validación Verificación x',
        },
      ],
      sourceDocumentName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
    });

    expect(result.drafts.filter((draft) => draft.findingType === 'FAR').map((draft) => draft.findingId)).toEqual(['FAR01', 'FAR02', 'FAR03', 'FAR05']);
    expect(result.drafts.find((draft) => draft.findingId === 'FAR01')).toEqual(expect.objectContaining({
      sourcePageRange: '48',
      closureStatus: 'open',
      requirement: '6.2 - 23',
    }));
    expect(result.drafts.find((draft) => draft.findingId === 'FAR02')).toEqual(expect.objectContaining({
      sourcePageRange: '48-49',
      closureStatus: 'open',
      requirement: 'G. 3',
    }));
    expect(result.drafts.find((draft) => draft.findingId === 'FAR03')).toEqual(expect.objectContaining({
      sourcePageRange: '49-50',
      closureStatus: 'open',
      requirement: '3.1.3',
    }));
    const far05 = result.drafts.find((draft) => draft.findingId === 'FAR05');
    expect(far05).toEqual(expect.objectContaining({
      sourcePageRange: '50',
      closureStatus: 'open',
      requirement: '3.2.21(6)',
    }));
    expect(far05?.evidenceExcerpt).not.toContain('APPENDIX 2: AUDIT PLAN');
    expect(far05?.evidenceExcerpt).not.toContain('Tipo de auditoria');
  });

  it('matches the full Appendix 1 finding register for the 1530 CCB report', () => {
    const expected = loadCcb1530ExpectedRegister();
    const result = extractManualFindingDraftsFromPages({
      pages: loadCcb1530AppendixPages(),
      sourceDocumentName: expected.sourceDocumentName,
    });

    expect(result.drafts).toHaveLength(expected.expectedFindingCount);
    expect(result.drafts.map((draft) => draft.findingId)).toEqual([
      'CAR01',
      'CAR02',
      'CAR03',
      'CAR04',
      'CAR05',
      'CAR06',
      'CAR07',
      'CL01',
      'CL02',
      'CL03',
      'CL04',
      'CL05',
      'CL06',
      'FAR01',
      'FAR02',
      'FAR03',
      'FAR05',
    ]);

    const actualRegister = result.drafts.map((draft) => ({
      findingId: draft.findingId,
      findingType: draft.findingType,
      sourcePageRange: draft.sourcePageRange,
      closureStatus: draft.closureStatus,
      hasRequirement: Boolean(draft.requirement?.trim()),
      hasDescription: Boolean(draft.description?.trim()),
      hasProjectResponse: Boolean(draft.projectResponse?.trim()),
      hasDocumentationSubmitted: Boolean(draft.documentationSubmitted?.trim()),
      hasAuditTeamEvaluation: Boolean(draft.auditTeamEvaluation?.trim()),
    }));

    expect(actualRegister).toEqual(expected.findings);
    expect(result.drafts.every((draft) => !draft.evidenceExcerpt.includes('APPENDIX 2'))).toBe(true);
    expect(result.drafts.every((draft) => !draft.evidenceExcerpt.includes('AUDIT PLAN'))).toBe(true);
    expect(result.drafts.find((draft) => draft.findingId === 'FAR05')).toEqual(expect.objectContaining({
      sourcePageRange: '50',
      closureStatus: 'open',
      requirement: '3.2.21(6)',
    }));
  });

  it('returns a truthful fallback when no findings are detected', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 1,
          text: 'Verification report summary. No appendix table for CAR, CL, or FAR was included in this sample.',
        },
      ],
      sourceDocumentName: 'summary-only.pdf',
    });

    expect(result.drafts).toEqual([]);
    expect(result.message).toBe('No structured CAR/CL/FAR findings detected. You can still add findings manually.');
  });

  it('marks uncertain extractions as needs review instead of pretending certainty', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 4,
          text: 'Appendix 1\nCAR09\nDescription: The appendix lists an unresolved issue but omits a clear project response or structured closure line.',
        },
      ],
      sourceDocumentName: 'uncertain-appendix.pdf',
    });

    expect(result.drafts[0]?.extractionStatus).toBe('needs-review');
    expect(result.drafts[0]?.extractionMessage).toBe('needs review');
  });
});
