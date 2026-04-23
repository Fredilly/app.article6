import type { Project, ProjectCoverage, ProjectRegistry, RuleReview } from '@/lib/projects/types';

export type VerificationReportStatus = 'ready' | 'registry_not_fully_supported' | 'insufficient_source_content';

export type VerificationReportSection = {
  title: string;
  lines: string[];
};

export type VerificationReportRuleGroup = {
  title: string;
  reviews: RuleReview[];
};

export type VerificationReportComposition = {
  registry: ProjectRegistry;
  status: VerificationReportStatus;
  title: string;
  subtitle: string;
  summaryItems: string[];
  sections: VerificationReportSection[];
  groupedReviews: VerificationReportRuleGroup[];
  openFindings: RuleReview[];
  provenance: Array<[string, string]>;
  limitation: string;
};

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

  const code = project.methodCode.trim().toUpperCase();
  if (!code) return 'Unknown';
  if (code.startsWith('UNFCCC.') || code.includes('UNFCCC')) return 'UNFCCC';
  if (code.startsWith('VM') || code.startsWith('VMR') || code.includes('VERRA')) return 'Verra';
  if (code.startsWith('GS') || code.includes('GOLD STANDARD')) return 'Gold Standard';
  if (/^(AR|AM|ACM|SSC|TOOL)/.test(code)) return 'UNFCCC';
  return 'Unknown';
}

function groupReviews(project: Project): VerificationReportRuleGroup[] {
  const grouped = project.reviews.reduce((acc, review) => {
    const key = sectionTitle(review.sectionId || 'Requirements');
    if (!acc[key]) acc[key] = [];
    acc[key].push(review);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  return Object.entries(grouped).map(([title, reviews]) => ({ title, reviews }));
}

function buildProvenance(project: Project, coverage: ProjectCoverage, registry: ProjectRegistry, status: VerificationReportStatus): Array<[string, string]> {
  return [
    ['Registry', registry],
    ['Report status', status],
    ['Project ID', project.id],
    ['Methodology', `${project.methodCode} @ ${project.methodVersion}`],
    ['Created', project.createdAt || 'n/a'],
    ['Rules reviewed', `${coverage.verified + coverage.gap} of ${coverage.total}`],
  ];
}

function buildOpenFindings(project: Project): RuleReview[] {
  return project.reviews.filter((review) => review.status === 'gap' || review.status === 'not-started' || review.status === 'in-progress');
}

function buildSummaryItems(project: Project, coverage: ProjectCoverage, registry: ProjectRegistry): string[] {
  const items = [
    `Registry: ${registry}`,
    `Methodology: ${project.methodCode} @ ${project.methodVersion}`,
    `Reviewed: ${coverage.verified + coverage.gap} of ${coverage.total} rules`,
  ];
  if (project.aoiLabel) items.push(`Area: ${project.aoiLabel}`);
  return items;
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

export function composeUnfcccVerificationReport(project: Project, coverage: ProjectCoverage): VerificationReportComposition {
  const registry = 'UNFCCC' as const;
  const reviewedCount = coverage.verified + coverage.gap;
  const groupedReviews = groupReviews(project);
  const openFindings = buildOpenFindings(project);

  if (reviewedCount === 0) {
    return {
      registry,
      status: 'insufficient_source_content',
      title: 'UNFCCC VERIFICATION REPORT',
      subtitle: 'Truthful fallback: reviewed rule content is not yet sufficient to render a full UNFCCC-facing report.',
      summaryItems: buildSummaryItems(project, coverage, registry),
      sections: [
        {
          title: 'SOURCE CONTENT STATUS',
          lines: [
            'UNFCCC registry detected for this project.',
            'A full UNFCCC report requires at least one completed rule review marked verified or gap.',
            `Current completed reviews: ${reviewedCount} of ${coverage.total}.`,
          ],
        },
        {
          title: 'AVAILABLE PROJECT CONTEXT',
          lines: [
            `Project: ${project.name}.`,
            `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
            project.aoiLabel ? `Area label: ${project.aoiLabel}.` : 'Area label: not provided.',
          ],
        },
      ],
      groupedReviews: [],
      openFindings: [],
      provenance: buildProvenance(project, coverage, registry, 'insufficient_source_content'),
      limitation: 'This export is a truthful fallback only. It does not represent a completed UNFCCC verification report.',
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
        title: 'ENGAGEMENT CONTEXT',
        lines: [
          `Project: ${project.name}.`,
          `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
          project.aoiLabel ? `Area label: ${project.aoiLabel}.` : 'Area label: not provided.',
          `Review status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
        ],
      },
      {
        title: 'REVIEW STATUS SUMMARY',
        lines: [
          `Verified rules: ${coverage.verified}.`,
          `Gap rules: ${coverage.gap}.`,
          `In-progress rules: ${coverage.inProgress}. Pending rules: ${coverage.notStarted}. Not-applicable rules: ${coverage.notApplicable}.`,
          `Percent complete across actionable rules: ${coverage.percentComplete}%.`,
        ],
      },
      {
        title: 'EVIDENCE TRACEABILITY',
        lines: buildEvidenceSummary(project),
      },
    ],
    groupedReviews,
    openFindings,
    provenance: buildProvenance(project, coverage, registry, 'ready'),
    limitation: 'This report summarizes reviewer-entered verification data. It is not a formal certification or issuance opinion.',
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
    groupedReviews: [],
    openFindings: [],
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

export function composeVerificationReport(project: Project, coverage: ProjectCoverage): VerificationReportComposition {
  const registry = resolveProjectRegistry(project);
  if (registry === 'UNFCCC') return composeUnfcccVerificationReport(project, coverage);
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
    groupedReviews: [],
    openFindings: [],
    provenance: buildProvenance(project, coverage, 'Unknown', 'registry_not_fully_supported'),
    limitation: 'This export is a generic truthful fallback only.',
  };
}

export function projectRegistryFromMethodProgram(program: string | undefined): ProjectRegistry {
  return normalizeRegistry(program?.split('/')[0]);
}
