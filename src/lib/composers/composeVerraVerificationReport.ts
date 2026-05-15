import type { Project, ProjectCoverage, ProjectRegistry } from '@/lib/projects/types';
import type {
  VerificationReportComposition,
  VerificationReportSection,
  VerificationReportStatus,
} from '@/lib/projects/verificationReport';
import {
  buildFindings,
  buildEvidenceSummary,
  buildProvenance,
  buildRequirementFindingLines,
  buildSummaryItems,
  countFindings,
  linesFromProvenance,
} from '@/lib/projects/verificationReport';
import { loadMethodologyMetadata } from '@/lib/composers/metadata';

const VERRA_SECTION_ORDER = [
  'REPORT STATUS',
  'METHODOLOGY SOURCE SECTIONS',
  'APPLICABILITY CONDITIONS',
  'PROJECT BOUNDARY',
  'BASELINE SCENARIO',
  'ADDITIONALITY',
  'QUANTIFICATION OF REMOVALS',
  'MONITORING',
  'EVIDENCE REVIEWED',
  'REQUIREMENT FINDINGS',
  'LIMITATIONS',
  'PROVENANCE',
] as const;

type SectionGroup = {
  applicability: string[];
  boundary: string[];
  baseline: string[];
  additionality: string[];
  quantification: string[];
  monitoring: string[];
  other: string[];
};

function groupSections(
  sections: { id: string; title: string }[],
): SectionGroup {
  const groups: SectionGroup = {
    applicability: [],
    boundary: [],
    baseline: [],
    additionality: [],
    quantification: [],
    monitoring: [],
    other: [],
  };

  const topLevel = sections.filter((s) => !s.id.includes('-'));

  for (const sec of topLevel) {
    const titleLc = sec.title.toLowerCase();
    const id = sec.id;

    if (/applicability/i.test(titleLc) || id === 'S-4') {
      groups.applicability.push(`- ${sec.title} (${sec.id})`);
    } else if (/boundary/i.test(titleLc) || id === 'S-5') {
      groups.boundary.push(`- ${sec.title} (${sec.id})`);
    } else if (/baseline/i.test(titleLc) || id === 'S-6') {
      groups.baseline.push(`- ${sec.title} (${sec.id})`);
    } else if (/additionality/i.test(titleLc) || id === 'S-7') {
      groups.additionality.push(`- ${sec.title} (${sec.id})`);
    } else if (/quantif|removal/i.test(titleLc) || id === 'S-8') {
      const children = sections.filter((s) => s.id.startsWith(`${id}-`));
      groups.quantification.push(`- ${sec.title} (${sec.id})`);
      for (const child of children) {
        groups.quantification.push(`    - ${child.title} (${child.id})`);
      }
    } else if (/monitoring/i.test(titleLc) || id === 'S-9') {
      const children = sections.filter((s) => s.id.startsWith(`${id}-`));
      groups.monitoring.push(`- ${sec.title} (${sec.id})`);
      for (const child of children) {
        groups.monitoring.push(`    - ${child.title} (${child.id})`);
      }
    } else {
      groups.other.push(`- ${sec.title} (${sec.id})`);
    }
  }

  return groups;
}

export function composeVerraVerificationReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): VerificationReportComposition {
  const registry: ProjectRegistry = 'Verra';
  const reviewedCount = coverage.verified + coverage.gap;
  const findings = buildFindings(project);
  const findingCounts = countFindings(findings);
  const status: VerificationReportStatus = reviewedCount === 0 ? 'insufficient_source_content' : 'ready';
  const provenance = buildProvenance(project, coverage, registry, status, exportTime);

  const meta = project.methodCode && project.methodVersion && project.methodCategory
    ? loadMethodologyMetadata('Verra', project.methodCategory, project.methodCode, project.methodVersion)
    : null;

  const sectionsMetadata = meta?.sections ?? [];
  const grouped = groupSections(sectionsMetadata);

  const sections: VerificationReportSection[] = [];

  sections.push({
    title: VERRA_SECTION_ORDER[0],
    lines: [
      `Registry: ${registry}.`,
      `Standard: VCS (Verified Carbon Standard).`,
      `Report status: ${status}.`,
      `Project status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
      `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
      `Completion summary: ${reviewedCount} of ${coverage.total} rules completed.`,
      'Draft limitation: this is a structured readiness review, not a VCS registry decision.',
    ],
  });

  const overviewLines: string[] = [
    `Methodology: ${meta?.title ?? `${project.methodCode} v${project.methodVersion}`}.`,
    `Standard: ${meta?.standard ?? 'VCS'}.`,
    project.methodCategory ? `Sector: ${project.methodCategory}.` : 'Sector: not provided.',
    meta?.domain ? `Domain: ${meta.domain}.` : null,
    '',
    'Canonical methodology sections from pack metadata:',
    ...grouped.other,
  ].filter((l): l is string => l !== null);

  if (project.aoiLabel) {
    overviewLines.push('', `AOI label: ${project.aoiLabel}.`);
  }
  sections.push({ title: VERRA_SECTION_ORDER[1], lines: overviewLines });

  sections.push({
    title: VERRA_SECTION_ORDER[2],
    lines: grouped.applicability.length > 0
      ? grouped.applicability
      : ['Applicability conditions are documented in the methodology source.'],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[3],
    lines: grouped.boundary.length > 0
      ? grouped.boundary
      : ['Project boundary is defined in the methodology source.'],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[4],
    lines: grouped.baseline.length > 0
      ? grouped.baseline
      : ['Baseline scenario is defined in the methodology source.'],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[5],
    lines: grouped.additionality.length > 0
      ? grouped.additionality
      : ['Additionality determination is defined in the methodology source.'],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[6],
    lines: grouped.quantification.length > 0
      ? grouped.quantification
      : ['Quantification of removals is defined in the methodology source.'],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[7],
    lines: grouped.monitoring.length > 0
      ? grouped.monitoring
      : ['Monitoring requirements are defined in the methodology source.'],
  });

  sections.push({ title: VERRA_SECTION_ORDER[8], lines: buildEvidenceSummary(project) });

  sections.push({
    title: VERRA_SECTION_ORDER[9],
    lines: [
      `OK: ${findingCounts.OK}. CL: ${findingCounts.CL}. NC: ${findingCounts.NC}. PENDING: ${findingCounts.PENDING}. NA: ${findingCounts.NA}.`,
      findingCounts.FAR > 0
        ? `FAR: ${findingCounts.FAR}.`
        : 'FAR: 0; no forward action requests are generated without explicit project data.',
      ...buildRequirementFindingLines(findings),
    ],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[10],
    lines: [
      meta?.disclaimerText ?? 'This draft readiness report summarizes reviewer-entered project review data. '
        + 'It is not a formal VCS validation, verification, or certification opinion. '
        + 'No VCUs have been issued or approved by Verra based on this report.',
      '',
      `Total rules: ${coverage.total}. Reviewed rules: ${reviewedCount}. Pending rules: ${coverage.notStarted}. Gap rules: ${coverage.gap}.`,
      `In-progress rules: ${coverage.inProgress}. Not-applicable rules: ${coverage.notApplicable}.`,
      `Percent complete across actionable rules: ${coverage.percentComplete}%.`,
    ],
  });

  sections.push({
    title: VERRA_SECTION_ORDER[11],
    lines: linesFromProvenance(provenance),
  });

  return {
    registry,
    status,
    title: 'VERRA READINESS REPORT',
    subtitle: 'VCS standard-specific readiness review composed from canonical methodology metadata.',
    summaryItems: buildSummaryItems(project, coverage, registry),
    sections,
    findings,
    provenance,
    limitation: meta?.disclaimerText ?? '',
  };
}
