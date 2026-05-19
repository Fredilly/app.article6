import type { Project, ProjectCoverage } from '@/lib/projects/types';
import type { VerificationReportComposition } from '@/lib/projects/verificationReport';
import { composeVerificationReport as genericComposer } from '@/lib/projects/verificationReport';

export async function composeStandardReport(
  project: Project,
  coverage: ProjectCoverage,
  exportTime?: string,
): Promise<VerificationReportComposition> {
  const registry = project.registry;
  if (registry === 'Verra') {
    try {
      const { composeVerraVerificationReport } = await import('@/lib/composers/composeVerraVerificationReport');
      return composeVerraVerificationReport(project, coverage, exportTime);
    } catch (err) {
      console.warn(`[composeReport] Verra composer failed, falling back to generic: ${err instanceof Error ? err.message : String(err)}`);
      return genericComposer(project, coverage, exportTime);
    }
  }
  if (registry === 'Gold Standard') {
    try {
      const { composeGoldStandardVerificationReport } = await import('@/lib/composers/composeGoldStandardVerificationReport');
      return composeGoldStandardVerificationReport(project, coverage, exportTime);
    } catch (err) {
      console.warn(`[composeReport] Gold Standard composer failed, falling back to generic: ${err instanceof Error ? err.message : String(err)}`);
      return genericComposer(project, coverage, exportTime);
    }
  }
  return genericComposer(project, coverage, exportTime);
}
