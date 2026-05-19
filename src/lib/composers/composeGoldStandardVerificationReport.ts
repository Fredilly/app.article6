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

const GS_SECTION_ORDER = [
  'REPORT STATUS',
  'METHODOLOGY SOURCE SECTIONS',
  'PROJECT DESIGN',
  'BASELINE SCENARIO',
  'ADDITIONALITY',
  'MONITORING',
  'SAFEGUARDS',
  'EVIDENCE REVIEWED',
  'REQUIREMENT FINDINGS',
  'LIMITATIONS',
  'PROVENANCE',
] as const;

type SectionGroup = {
  design: string[];
  baseline: string[];
  additionality: string[];
  monitoring: string[];
  safeguards: string[];
  other: string[];
};

function groupGSSections(
  sections: { id: string; title: string; parentId?: string | null }[],
): SectionGroup {
  const groups: SectionGroup = {
    design: [],
    baseline: [],
    additionality: [],
    monitoring: [],
    safeguards: [],
    other: [],
  };

  const topLevel = sections.filter((s) => !s.parentId);

  for (const sec of topLevel) {
    const titleLc = sec.title.toLowerCase();

    if (/applicability|design|descript|definition|source/i.test(titleLc)) {
      groups.design.push(`- ${sec.title} (${sec.id})`);
    } else if (/baseline|reference/i.test(titleLc)) {
      groups.baseline.push(`- ${sec.title} (${sec.id})`);
    } else if (/additionality/i.test(titleLc)) {
      groups.additionality.push(`- ${sec.title} (${sec.id})`);
    } else if (/monitoring/i.test(titleLc)) {
      const children = sections.filter((s) => s.parentId === sec.id);
      groups.monitoring.push(`- ${sec.title} (${sec.id})`);
      for (const child of children) {
        groups.monitoring.push(`    - ${child.title} (${child.id})`);
      }
    } else if (/safeguard|stakeholder|sustainable|sdg|environmental|social/i.test(titleLc)) {
      groups.safeguards.push(`- ${sec.title} (${sec.id})`);
    } else if (/quantif|removal|emission|leakage|uncertainty/i.test(titleLc)) {
      const children = sections.filter((s) => s.parentId === sec.id);
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

export function composeGoldStandardVerificationReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): VerificationReportComposition {
  const registry: ProjectRegistry = 'Gold Standard';
  const reviewedCount = coverage.verified + coverage.gap;
  const findings = buildFindings(project);
  const findingCounts = countFindings(findings);
  const status: VerificationReportStatus = reviewedCount === 0 ? 'insufficient_source_content' : 'ready';
  const provenance = buildProvenance(project, coverage, registry, status, exportTime);

  const meta = project.methodCode && project.methodVersion && project.methodCategory
    ? loadMethodologyMetadata('Gold Standard', project.methodCategory, project.methodCode, project.methodVersion)
    : null;

  const sectionsMetadata = meta?.sections ?? [];
  const grouped = groupGSSections(sectionsMetadata);

  const sections: VerificationReportSection[] = [];

  sections.push({
    title: GS_SECTION_ORDER[0],
    lines: [
      `Registry: ${registry}.`,
      `Standard: Gold Standard for the Global Goals (GS4GG).`,
      `Report status: ${status}.`,
      `Project status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}.`,
      `Methodology: ${project.methodCode} @ ${project.methodVersion}.`,
      `Completion summary: ${reviewedCount} of ${coverage.total} rules completed.`,
      'Draft limitation: this is a structured readiness review, not a Gold Standard registry decision.',
    ],
  });

  const overviewLines: string[] = [
    `Methodology: ${meta?.title ?? `${project.methodCode} v${project.methodVersion}`}.`,
    `Standard: ${meta?.standard ?? 'Gold Standard'}.`,
    project.methodCategory ? `Sector: ${project.methodCategory}.` : 'Sector: not provided.',
    meta?.domain ? `Domain: ${meta.domain}.` : null,
    '',
    'Canonical methodology sections from pack metadata:',
    ...grouped.other,
  ].filter((l): l is string => l !== null);

  if (project.aoiLabel) {
    overviewLines.push('', `AOI label: ${project.aoiLabel}.`);
  }
  sections.push({ title: GS_SECTION_ORDER[1], lines: overviewLines });

  sections.push({
    title: GS_SECTION_ORDER[2],
    lines: grouped.design.length > 0
      ? grouped.design
      : ['Project design parameters are documented in the methodology source.'],
  });

  sections.push({
    title: GS_SECTION_ORDER[3],
    lines: grouped.baseline.length > 0
      ? grouped.baseline
      : ['Baseline scenario is defined in the methodology source.'],
  });

  sections.push({
    title: GS_SECTION_ORDER[4],
    lines: grouped.additionality.length > 0
      ? grouped.additionality
      : ['Additionality determination is defined in the methodology source.'],
  });

  sections.push({
    title: GS_SECTION_ORDER[5],
    lines: grouped.monitoring.length > 0
      ? grouped.monitoring
      : ['Monitoring requirements are defined in the methodology source.'],
  });

  sections.push({
    title: GS_SECTION_ORDER[6],
    lines: grouped.safeguards.length > 0
      ? grouped.safeguards
      : ['Safeguards and stakeholder consultation requirements are defined in the methodology source.'],
  });

  sections.push({ title: GS_SECTION_ORDER[7], lines: buildEvidenceSummary(project) });

  sections.push({
    title: GS_SECTION_ORDER[8],
    lines: [
      `OK: ${findingCounts.OK}. CL: ${findingCounts.CL}. NC: ${findingCounts.NC}. PENDING: ${findingCounts.PENDING}. NA: ${findingCounts.NA}.`,
      findingCounts.FAR > 0
        ? `FAR: ${findingCounts.FAR}.`
        : 'FAR: 0; no forward action requests are generated without explicit project data.',
      ...buildRequirementFindingLines(findings),
    ],
  });

  sections.push({
    title: GS_SECTION_ORDER[9],
    lines: [
      meta?.disclaimerText ?? 'This draft readiness report summarizes reviewer-entered project review data. '
        + 'It is not a formal Gold Standard validation, verification, or certification opinion. '
        + 'No GS certified emission reductions or SDG contributions have been approved based on this report.',
      '',
      `Total rules: ${coverage.total}. Reviewed rules: ${reviewedCount}. Pending rules: ${coverage.notStarted}. Gap rules: ${coverage.gap}.`,
      `In-progress rules: ${coverage.inProgress}. Not-applicable rules: ${coverage.notApplicable}.`,
      `Percent complete across actionable rules: ${coverage.percentComplete}%.`,
    ],
  });

  sections.push({
    title: GS_SECTION_ORDER[10],
    lines: linesFromProvenance(provenance),
  });

  return {
    registry,
    status,
    title: 'GOLD STANDARD READINESS REPORT',
    subtitle: 'Gold Standard readiness review composed from canonical methodology metadata.',
    summaryItems: buildSummaryItems(project, coverage, registry),
    sections,
    findings,
    provenance,
    limitation: meta?.disclaimerText ?? '',
  };
}
