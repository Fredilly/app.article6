import {
  buildManualReportFinding,
  buildReportFinding,
  type ReportFinding,
  type ReportFindingCode,
} from '@/lib/projects/reportFindings';
import type { Project, ProjectCoverage, ProjectRegistry } from '@/lib/projects/types';

export type VerificationReportStatus = 'ready' | 'registry_not_fully_supported' | 'insufficient_source_content';

export type VerificationReportSection = {
  title: string;
  lines: string[];
};

export type VerificationReportComposition = {
  registry: ProjectRegistry;
  status: VerificationReportStatus;
  title: string;
  subtitle: string;
  summaryItems: string[];
  sections: VerificationReportSection[];
  findings: ReportFinding[];
  provenance: Array<[string, string]>;
  limitation: string;
};

const UNFCCC_SECTION_ORDER = [
  'REPORT STATUS',
  'PROJECT AND METHODOLOGY IDENTIFICATION',
  'VERIFICATION SCOPE',
  'MEANS OF VERIFICATION',
  'FINDINGS SUMMARY',
  'REQUIREMENT FINDINGS',
  'EVIDENCE APPENDIX',
  'LIMITATIONS',
  'PROVENANCE',
] as const;

function sectionTitle(sectionId: string): string {
  const titles: Record<string, string> = {
    'S-1': 'Scope and Boundary',
    'S-2': 'Baseline',
    'S-3': 'Monitoring',
    'S-4': 'Leakage',
    'S-5': 'Permanence',
  };
  return titles[sectionId] ?? sectionId;
}

function normalizeRegistry(value: string | undefined): ProjectRegistry {
  const raw = value?.trim().toLowerCase() ?? '';
  if (!raw) return 'Unknown';
  if (raw.startsWith('unfccc') || raw === 'cdm') return 'UNFCCC';
  if (raw.startsWith('verra') || raw.includes('verified carbon standard') || raw === 'vcs') return 'Verra';
  if (raw.startsWith('gold standard') || raw === 'gold-standard' || raw === 'gs') return 'Gold Standard';
  return 'Unknown';
}

export function resolveProjectRegistry(project: Pick<Project, 'methodCode' | 'registry'>): ProjectRegistry {
  const explicit = normalizeRegistry(project.registry);
  if (explicit !== 'Unknown') return explicit;

  const code = project.methodCode?.trim().toUpperCase() ?? '';
  if (!code) return 'Unknown';
  if (code.startsWith('UNFCCC.') || code.includes('UNFCCC')) return 'UNFCCC';
  if (code.startsWith('VM') || code.startsWith('VMR') || code.includes('VERRA')) return 'Verra';
  if (code.startsWith('GS') || code.includes('GOLD STANDARD')) return 'Gold Standard';
  if (/^(AR|AM|ACM|SSC|TOOL)/.test(code)) return 'UNFCCC';
  return 'Unknown';
}

function buildProvenance(
  project: Project,
  coverage: ProjectCoverage,
  registry: ProjectRegistry,
  status: VerificationReportStatus,
  exportTime = 'generated during export',
): Array<[string, string]> {
  const items: Array<[string, string]> = [
    ['Manual review mode', project.reviewMode === 'manual' ? 'true' : 'false'],
    ['Registry', registry],
    ['Report status', status],
    ['Project ID', project.id],
    ['Methodology', project.methodCode && project.methodVersion ? `${project.methodCode} @ ${project.methodVersion}` : 'n/a'],
    ['Created', project.createdAt || 'n/a'],
    ['Rules reviewed', `${coverage.verified + coverage.gap} of ${coverage.total}`],
    ['Export time', exportTime],
  ];

  if (project.lockedAt) items.splice(5, 0, ['Locked', project.lockedAt]);
  return items;
}

function buildSummaryItems(project: Project, coverage: ProjectCoverage, registry: ProjectRegistry): string[] {
  const items = [
    `Manual review mode: ${project.reviewMode === 'manual' ? 'true' : 'false'}`,
    `Registry: ${registry}`,
    `Methodology: ${project.methodCode && project.methodVersion ? `${project.methodCode} @ ${project.methodVersion}` : 'n/a'}`,
    `Reviewed: ${coverage.verified + coverage.gap} of ${coverage.total} items`,
  ];
  if (project.aoiLabel) items.push(`Area: ${project.aoiLabel}`);
  return items;
}

function fallbackValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function manualRegistryLabel(project: Project): string {
  return project.registry && project.registry !== 'Unknown' ? project.registry : 'Unknown registry';
}

function manualMethodologyLabel(project: Project): string {
  return project.methodCode && project.methodVersion
    ? `${project.methodCode} @ ${project.methodVersion}`
    : 'Manual review - methodology not wired';
}

function sourceDocumentTypeLabel(project: Project): string {
  if (project.documents.some((document) => document.mimeType === 'application/pdf')) return 'Published verification report PDF';
  if (project.documents.length > 0) return 'Uploaded source document';
  return 'Not provided';
}

function manualFindingTypeCounts(project: Project): { CAR: number; CL: number; FAR: number } {
  return project.manualFindings.reduce((counts, finding) => {
    if (finding.findingType === 'CAR' || finding.findingType === 'CL' || finding.findingType === 'FAR') {
      counts[finding.findingType] += 1;
    }
    return counts;
  }, { CAR: 0, CL: 0, FAR: 0 });
}

function buildEvidenceSummary(project: Project): string[] {
  const linkedEvidenceCount = project.reviews.reduce((sum, review) => sum + review.evidenceIds.length, 0);
  const notedRules = project.reviews.filter((review) => Boolean(review.note?.trim())).length;
  return [
    `Linked evidence references recorded: ${linkedEvidenceCount}.`,
    `Reviewer rationale notes recorded: ${notedRules}.`,
    'No certification opinion, quantified impacts, or unsupported findings are added beyond reviewer-entered project data.',
  ];
}

function buildFindings(project: Project): ReportFinding[] {
  return project.reviews.map((review, index) => buildReportFinding(
    review,
    index,
    sectionTitle(review.sectionId || 'Requirements'),
  ));
}

function countFindings(findings: ReportFinding[]): Record<ReportFindingCode, number> {
  return findings.reduce((acc, finding) => {
    acc[finding.code] += 1;
    return acc;
  }, { OK: 0, CL: 0, NC: 0, CAR: 0, FAR: 0, PENDING: 0, NA: 0 } as Record<ReportFindingCode, number>);
}

function linesFromProvenance(provenance: Array<[string, string]>): string[] {
  return provenance.map(([label, value]) => `${label}: ${value || 'n/a'}.`);
}

function buildRequirementFindingLines(findings: ReportFinding[]): string[] {
  if (findings.length === 0) return ['No requirement findings are available from current project review data.'];
  return findings.flatMap((finding) => [
    `${finding.findingId} [${finding.code}] ${finding.ruleId}: ${finding.ruleTitle}.`,
    `Section: ${finding.sectionTitle}.`,
    `Rationale: ${finding.rationale}`,
    ...(finding.limitation ? [`Limitation: ${finding.limitation}`] : []),
    `Evidence references: ${finding.evidenceIds.length}.`,
  ]);
}

function buildEvidenceAppendixLines(findings: ReportFinding[]): string[] {
  const lines = findings.flatMap((finding) => {
    if (finding.evidenceIds.length === 0) return [`${finding.findingId}: No linked evidence references recorded.`];
    return finding.evidenceIds.map((id) => `${finding.findingId}: Evidence reference: ${id}.`);
  });

  return lines.length > 0 ? lines : ['No linked evidence references recorded.'];
}

export function composeUnfcccVerificationReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): VerificationReportComposition {
  const registry = 'UNFCCC' as const;
  const reviewedCount = coverage.verified + coverage.gap;
  const findings = buildFindings(project);
  const findingCounts = countFindings(findings);
  const provenance = buildProvenance(project, coverage, registry, reviewedCount === 0 ? 'insufficient_source_content' : 'ready', exportTime);
  const limitation = 'This draft report summarizes reviewer-entered Article6 project review data. It is not a formal certification, validation, verification opinion, issuance approval, or registry decision.';

  if (reviewedCount === 0) {
    return {
      registry,
      status: 'insufficient_source_content',
      title: 'UNFCCC VERIFICATION REPORT',
      subtitle: 'Truthful fallback: reviewed rule content is not yet sufficient to render a full UNFCCC-facing report.',
      summaryItems: buildSummaryItems(project, coverage, registry),
      sections: [
        { title: UNFCCC_SECTION_ORDER[0], lines: [
          `Registry: ${registry}.`,
          'Report status: insufficient_source_content.',
          `Project status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          `Completion summary: ${reviewedCount} of ${coverage.total} rules completed.`,
          'Draft limitation: completed reviewer source content is not yet sufficient for a full UNFCCC draft report.',
        ] },
        { title: UNFCCC_SECTION_ORDER[1], lines: [
          `Project name: ${project.name}.`,
          `Project ID: ${project.id}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          project.aoiLabel ? `AOI label: ${project.aoiLabel}.` : 'AOI label: not provided.',
          `Created date: ${project.createdAt || 'n/a'}.`,
          project.lockedAt ? `Locked date: ${project.lockedAt}.` : 'Locked date: not locked.',
        ] },
        { title: UNFCCC_SECTION_ORDER[2], lines: [
          `Total rules: ${coverage.total}. Reviewed rules: ${reviewedCount}. Pending rules: ${coverage.notStarted}. Gap rules: ${coverage.gap}.`,
          'No certification, registry approval, or issuance conclusion is made by this draft report.',
        ] },
        { title: UNFCCC_SECTION_ORDER[3], lines: buildEvidenceSummary(project) },
        { title: UNFCCC_SECTION_ORDER[4], lines: [
          `OK: ${findingCounts.OK}. CL: ${findingCounts.CL}. NC: ${findingCounts.NC}. PENDING: ${findingCounts.PENDING}. NA: ${findingCounts.NA}.`,
          findingCounts.FAR > 0 ? `FAR: ${findingCounts.FAR}.` : 'FAR: 0; no forward action requests are generated without explicit project data.',
        ] },
        { title: UNFCCC_SECTION_ORDER[5], lines: buildRequirementFindingLines(findings) },
        { title: UNFCCC_SECTION_ORDER[6], lines: buildEvidenceAppendixLines(findings) },
        { title: UNFCCC_SECTION_ORDER[7], lines: [limitation] },
        { title: UNFCCC_SECTION_ORDER[8], lines: linesFromProvenance(provenance) },
      ],
      findings,
      provenance,
      limitation,
    };
  }

  return {
    registry,
    status: 'ready',
    title: 'UNFCCC VERIFICATION REPORT',
    subtitle: 'Rendered from current project, review, and evidence-link data without adding unsupported registry conclusions.',
    summaryItems: buildSummaryItems(project, coverage, registry),
    sections: [
      {
        title: UNFCCC_SECTION_ORDER[0],
        lines: [
          `Registry: ${registry}.`,
          'Report status: ready.',
          `Project status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          `Completion summary: ${reviewedCount} of ${coverage.total} rules completed.`,
          'Draft limitation: this is a structured VVB-style draft workpaper, not a registry decision.',
        ],
      },
      {
        title: UNFCCC_SECTION_ORDER[1],
        lines: [
          `Project name: ${project.name}.`,
          `Project ID: ${project.id}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          project.aoiLabel ? `AOI label: ${project.aoiLabel}.` : 'AOI label: not provided.',
          `Created date: ${project.createdAt || 'n/a'}.`,
          project.lockedAt ? `Locked date: ${project.lockedAt}.` : 'Locked date: not locked.',
        ],
      },
      {
        title: UNFCCC_SECTION_ORDER[2],
        lines: [
          `Total rules: ${coverage.total}. Reviewed rules: ${reviewedCount}. Pending rules: ${coverage.notStarted}. Gap rules: ${coverage.gap}.`,
          `In-progress rules: ${coverage.inProgress}. Not-applicable rules: ${coverage.notApplicable}.`,
          `Percent complete across actionable rules: ${coverage.percentComplete}%.`,
          'No certification, registry approval, or issuance conclusion is made by this draft report.',
        ],
      },
      {
        title: UNFCCC_SECTION_ORDER[3],
        lines: buildEvidenceSummary(project),
      },
      {
        title: UNFCCC_SECTION_ORDER[4],
        lines: [
          `OK: ${findingCounts.OK}. CL: ${findingCounts.CL}. NC: ${findingCounts.NC}. PENDING: ${findingCounts.PENDING}. NA: ${findingCounts.NA}.`,
          findingCounts.FAR > 0 ? `FAR: ${findingCounts.FAR}.` : 'FAR: 0; no forward action requests are generated without explicit project data.',
        ],
      },
      { title: UNFCCC_SECTION_ORDER[5], lines: buildRequirementFindingLines(findings) },
      { title: UNFCCC_SECTION_ORDER[6], lines: buildEvidenceAppendixLines(findings) },
      { title: UNFCCC_SECTION_ORDER[7], lines: [limitation] },
      { title: UNFCCC_SECTION_ORDER[8], lines: linesFromProvenance(provenance) },
    ],
    findings,
    provenance,
    limitation,
  };
}

function composeRecognizedFallbackReport(
  registry: 'Verra' | 'Gold Standard',
  project: Project,
  coverage: ProjectCoverage,
): VerificationReportComposition {
  return {
    registry,
    status: 'registry_not_fully_supported',
    title: `${registry.toUpperCase()} VERIFICATION REPORT`,
    subtitle: `Truthful fallback: ${registry} is recognized in the export pipeline, but a full ${registry}-specific renderer is not shipped in v1.`,
    summaryItems: buildSummaryItems(project, coverage, registry),
    sections: [
      {
        title: 'REGISTRY SUPPORT STATUS',
        lines: [
          `${registry} registry detected for this project.`,
          `${registry} full renderer not yet implemented in v1.`,
          'The system therefore emits a fallback report state instead of pretending a full registry-shaped report exists.',
        ],
      },
      {
        title: 'AVAILABLE REVIEW DATA',
        lines: [
          `Project: ${project.name}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          `Completed reviews captured so far: ${coverage.verified + coverage.gap} of ${coverage.total}.`,
        ],
      },
    ],
    findings: [],
    provenance: buildProvenance(project, coverage, registry, 'registry_not_fully_supported'),
    limitation: `This export is not a full ${registry} verification report. It is a truthful fallback summary only.`,
  };
}

export function composeVerraVerificationReport(project: Project, coverage: ProjectCoverage): VerificationReportComposition {
  return composeRecognizedFallbackReport('Verra', project, coverage);
}

export function composeGoldStandardVerificationReport(project: Project, coverage: ProjectCoverage): VerificationReportComposition {
  return composeRecognizedFallbackReport('Gold Standard', project, coverage);
}

export function composeManualVerificationReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): VerificationReportComposition {
  const findings = project.manualFindings.map((finding) => {
    const sourceDocumentLabel = project.documents.find((document) => document.id === finding.sourceDocumentId)?.fileName ?? 'No source document linked';
    return buildManualReportFinding(finding, sourceDocumentLabel);
  });
  const exportTimestamp = exportTime ?? 'generated during export';
  const status = findings.length === 0 ? 'insufficient_source_content' : 'ready';
  const registryLabel = manualRegistryLabel(project);
  const methodologyLabel = manualMethodologyLabel(project);
  const sourceDocumentName = project.documents[0]?.fileName ?? 'Not provided';
  const typeCounts = manualFindingTypeCounts(project);
  const openCount = project.manualFindings.filter((finding) => finding.closureStatus === 'open').length;
  const inReviewCount = project.manualFindings.filter((finding) => finding.closureStatus === 'in-review').length;
  const closedCount = project.manualFindings.filter((finding) => finding.closureStatus === 'closed').length;
  const provenance = [
    ['Manual review mode', 'true'],
    ['Project ID', project.id],
    ['Source document count', String(project.documents.length)],
    ['Findings count', String(project.manualFindings.length)],
    ['Locked status', project.status === 'locked' ? 'Locked' : 'In Progress'],
    ['Locked timestamp', project.lockedAt ?? 'Not provided'],
    ['Export timestamp', exportTimestamp],
    ['Registry / Standard', registryLabel],
    ['Registry project ID', 'Not provided'],
    ['Methodology / reference', methodologyLabel],
    ['Limitation', 'This report reconstructs findings from uploaded source documents. It is not an independent verification opinion, validation statement, or methodology compliance determination.'],
  ] satisfies Array<[string, string]>;

  return {
    registry: project.registry ?? 'Unknown',
    status,
    title: 'VVB FINDINGS RECONSTRUCTION',
    subtitle: 'Project-level reconstruction of published VVB findings from uploaded source documents.',
    summaryItems: [
      `Manual review report`,
      `Project: ${project.name}`,
      `Registry / Standard: ${registryLabel}`,
      `Source documents: ${project.documents.length}`,
    ],
    sections: [
      {
        title: 'REPORT LIMITATION',
        lines: [
          'This report reconstructs findings from uploaded source documents. It is not an independent verification opinion, validation statement, or methodology compliance determination.',
        ],
      },
      {
        title: 'OUTCOME',
        lines: [
          `${project.manualFindings.length} VVB finding sections were reconstructed from the uploaded source document set.`,
          `The review identified ${closedCount} closed findings, ${openCount} open findings, and ${inReviewCount} findings still marked in review.`,
          'Findings remain reviewer-controlled records and do not represent a new verification opinion.',
        ],
      },
      {
        title: 'PROJECT METADATA',
        lines: [
          `Registry / Standard: ${registryLabel}.`,
          'Registry project ID: Not provided.',
          `Project name: ${project.name}.`,
          `Source document type: ${sourceDocumentTypeLabel(project)}.`,
          `Source document name: ${sourceDocumentName}.`,
          `Methodology / reference: ${methodologyLabel}.`,
          'Review mode: Manual review.',
          `Locked status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
          `Export timestamp: ${exportTimestamp}.`,
          `Project area: ${fallbackValue(project.aoiLabel, 'Not provided')}.`,
          `Project description: ${fallbackValue(project.description, 'Not provided')}.`,
        ],
      },
      {
        title: 'FINDINGS SUMMARY',
        lines: [
          `CAR: ${typeCounts.CAR}. CL: ${typeCounts.CL}. FAR: ${typeCounts.FAR}.`,
          `Closed: ${closedCount}. Open: ${openCount}. In review: ${inReviewCount}.`,
          `Source documents: ${project.documents.length}. Findings recorded: ${project.manualFindings.length}.`,
        ],
      },
      {
        title: 'FINDING DETAILS',
        lines: project.manualFindings.length > 0
          ? project.manualFindings.flatMap((finding) => {
            const sourceDocumentLabel = project.documents.find((document) => document.id === finding.sourceDocumentId)?.fileName ?? 'No source document linked';
            return [
              `Finding ID: ${finding.findingId}.`,
              `Type: ${finding.findingType}.`,
              `Closure status: ${finding.closureStatus}.`,
              `Source document: ${sourceDocumentLabel}.`,
              `Source page/range: ${finding.sourcePageRange?.trim() || 'Not provided'}.`,
              `Requirement: ${finding.requirement?.trim() || 'Not provided'}.`,
              `Description: ${finding.description?.trim() || 'Not provided'}.`,
              `Project response: ${finding.projectResponse?.trim() || 'Not provided'}.`,
              `Documentation submitted: ${finding.documentationSubmitted?.trim() || 'Not provided'}.`,
              `Audit team evaluation: ${finding.auditTeamEvaluation?.trim() || 'Not provided'}.`,
              `Reviewer note: ${finding.reviewerNote?.trim() || 'Needs review'}.`,
              `Source excerpt: ${finding.evidenceExcerpt?.trim() || 'Not provided'}.`,
            ];
          })
          : ['No manual findings have been recorded yet.'],
      },
      {
        title: 'PROVENANCE AND LIMITATIONS',
        lines: linesFromProvenance(provenance),
      },
    ],
    findings,
    provenance,
    limitation: 'This report reconstructs findings from uploaded source documents. It is not an independent verification opinion, validation statement, or methodology compliance determination.',
  };
}

export function composeVerificationReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): VerificationReportComposition {
  if (project.reviewMode === 'manual') return composeManualVerificationReport(project, coverage, exportTime);
  const registry = resolveProjectRegistry(project);
  if (registry === 'UNFCCC') return composeUnfcccVerificationReport(project, coverage, exportTime);
  if (registry === 'Verra') return composeVerraVerificationReport(project, coverage);
  if (registry === 'Gold Standard') return composeGoldStandardVerificationReport(project, coverage);

  return {
    registry: 'Unknown',
    status: 'registry_not_fully_supported',
    title: 'VERIFICATION REPORT',
    subtitle: 'Truthful fallback: registry could not be resolved confidently from current project data.',
    summaryItems: buildSummaryItems(project, coverage, 'Unknown'),
    sections: [
      {
        title: 'REGISTRY STATUS',
        lines: [
          'The export pipeline could not confidently map this project to UNFCCC, Verra, or Gold Standard.',
          'No registry-specific report renderer was used.',
        ],
      },
    ],
    findings: [],
    provenance: buildProvenance(project, coverage, 'Unknown', 'registry_not_fully_supported'),
    limitation: 'This export is a generic truthful fallback only.',
  };
}

export function projectRegistryFromMethodProgram(program: string | undefined): ProjectRegistry {
  return normalizeRegistry(program?.split('/')[0]);
}
