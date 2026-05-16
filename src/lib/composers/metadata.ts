import fs from 'fs';
import path from 'path';

export type ComposerSection = {
  id: string;
  stableId: string;
  title: string;
  anchor: string;
  sectionNumber: string;
  sectionLevel: number;
  parentId: string | null;
};

export type ComposerExpectedEvidence = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

export type ComposerRuleRef = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  summary: string;
  logic: string;
  expectedEvidence: ComposerExpectedEvidence[];
};

export type MethodologyMetadata = {
  methodCode: string;
  version: string;
  standard: string;
  category: string;
  domain: string;
  title: string;
  sections: ComposerSection[];
  rules: ComposerRuleRef[];
  disclaimerText: string;
};

const STANDARD_DISCLAIMERS: Record<string, string> = {
  Verra:
    'This draft readiness report summarizes reviewer-entered project review data. '
    + 'It is not a formal VCS validation, verification, or certification opinion. '
    + 'No VCUs have been issued or approved by Verra based on this report.',
  'Gold Standard':
    'This draft readiness report summarizes reviewer-entered project review data. '
    + 'It is not a formal Gold Standard validation, verification, or certification opinion. '
    + 'No GS certified emission reductions or SDG contributions have been approved based on this report.',
};

function loadJson(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw);
}

export function loadMethodologyMetadata(
  provider: string,
  category: string,
  methodCode: string,
  version: string,
): MethodologyMetadata | null {
  const packDir = path.join(
    process.cwd(),
    'public',
    'methodologies',
    provider,
    category,
    methodCode,
    version,
  );

  const sectionsData = loadJson(path.join(packDir, 'sections.json'));
  if (!sectionsData) return null;

    const sectionsRaw = (sectionsData as { sections: unknown[] }).sections ?? [];
    const sections: ComposerSection[] = sectionsRaw.map((entry: unknown) => {
      const s = entry as Record<string, unknown>;
      return {
        id: String(s.id ?? ''),
        stableId: String(s.stable_id ?? ''),
        title: String(s.title ?? ''),
        anchor: String(s.anchor ?? ''),
        sectionNumber: String(s.sectionNumber ?? s.section_number ?? ''),
        sectionLevel: Number(s.sectionLevel ?? s.section_level ?? 1),
        parentId: (s.parentId ?? s.parent_id ?? null) as string | null,
      };
    });

  const rulesRaw = loadJson(path.join(packDir, 'rules.rich.json'));
  const rules: ComposerRuleRef[] = [];
  if (rulesRaw && Array.isArray(rulesRaw)) {
    for (const r of rulesRaw as Record<string, unknown>[]) {
      const refs = (r.refs as Record<string, unknown>) ?? {};
      const coverage = (r.requirement_coverage as Record<string, unknown>) ?? {};
      const evidenceRaw = (coverage.expected_evidence as Record<string, unknown>[]) ?? [];
      rules.push({
        ruleId: String(r.stable_id ?? r.id ?? ''),
        ruleTitle: String(r.summary ?? r.title ?? ''),
        sectionId: String(refs.primary_section ?? refs.section_id ?? ''),
        summary: String(r.summary ?? ''),
        logic: String(r.logic ?? ''),
        expectedEvidence: evidenceRaw.map((e: Record<string, unknown>) => ({
          id: String(e.id ?? ''),
          label: String(e.label ?? ''),
          description: String(e.description ?? ''),
          required: Boolean(e.required ?? false),
        })),
      });
    }
  }

  const metaData = loadJson(path.join(packDir, 'META.json')) as Record<string, unknown> | null;
  const disclaimerText =
    STANDARD_DISCLAIMERS[provider] ??
    `This draft readiness report summarizes reviewer-entered project review data. It is not a formal ${provider} validation, verification, or certification opinion.`;

  return {
    methodCode,
    version,
    standard: String(metaData?.standard ?? provider ?? ''),
    category,
    domain: String(metaData?.domain ?? ''),
    title: String(metaData?.title ?? `${methodCode} v${version}`),
    sections,
    rules,
    disclaimerText,
  };
}

export function getComposerForMethod(
  provider: string,
  category: string,
  methodCode: string,
  version: string,
): MethodologyMetadata | null {
  return loadMethodologyMetadata(provider, category, methodCode, version);
}
