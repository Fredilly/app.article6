import fs from 'node:fs';
import path from 'node:path';

const PACK_ROOT = path.join(process.cwd(), 'public', 'methodologies');

export type EvidenceTaxonomyEntry = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

export type ExportSectionTaxonomy = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  export_order: number;
  parent_id: string | null;
  evidence_categories: string[];
};

export type ExportMetadata = {
  standard: string;
  metadata_version: string;
  last_updated: string;
  section_taxonomy: ExportSectionTaxonomy[];
};

export type ExpectedEvidence = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

export type RuleExpectedEvidence = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  expectedEvidence: ExpectedEvidence[];
};

export type AdoptionStatus = {
  adoption_status: string;
  note?: string;
  version?: string;
};

export type ReviewGradeContract = {
  provider: string;
  methodCode: string;
  version: string;
  category: string;
  adoptionStatus: AdoptionStatus | null;
  isReviewGrade: boolean;
  expectedEvidence: RuleExpectedEvidence[];
  taxonomy: EvidenceTaxonomyEntry[];
  exportMetadata: ExportMetadata | null;
};

function loadJson(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  try {
    const raw = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function providerDir(provider: string): string {
  const dirMap: Record<string, string> = {
    'Gold Standard': 'GoldStandard',
    'GoldStandard': 'GoldStandard',
    'gold standard': 'GoldStandard',
  };
  const mapped = dirMap[provider] ?? provider;
  return path.join(PACK_ROOT, mapped);
}

function methodDir(provider: string, category: string, code: string, version: string): string {
  return path.join(providerDir(provider), category, code, version);
}

export function loadEvidenceTaxonomy(): EvidenceTaxonomyEntry[] {
  const taxonomyPath = path.join(PACK_ROOT, 'config', 'evidence-taxonomy.json');
  const data = loadJson(taxonomyPath);
  if (!data || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((entry) => ({
    id: String(entry.id ?? ''),
    label: String(entry.label ?? ''),
    description: String(entry.description ?? ''),
    required: Boolean(entry.required ?? false),
  }));
}

export function loadMethodMeta(packDir: string): Record<string, unknown> | null {
  const metaPath = path.join(packDir, 'META.json');
  const data = loadJson(metaPath);
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

export function loadAdoptionStatus(packDir: string): AdoptionStatus | null {
  const meta = loadMethodMeta(packDir);
  if (!meta) return null;
  const quality = meta.artifact_quality_standard as Record<string, unknown> | undefined;
  if (!quality || typeof quality !== 'object') return null;
  const status = String(quality.adoption_status ?? '');
  if (!status) return null;
  return {
    adoption_status: status,
    note: String(quality.note ?? ''),
    version: String(quality.version ?? ''),
  };
}

export function isReviewGrade(status: AdoptionStatus | null): boolean {
  return status?.adoption_status === 'review_grade';
}

export function loadExpectedEvidence(packDir: string): RuleExpectedEvidence[] {
  const rulesRaw = loadJson(path.join(packDir, 'rules.rich.json'));
  if (!rulesRaw || !Array.isArray(rulesRaw)) return [];

  const result: RuleExpectedEvidence[] = [];
  for (const r of rulesRaw as Record<string, unknown>[]) {
    const coverage = (r.requirement_coverage as Record<string, unknown>) ?? {};
    const evidenceRaw = (coverage.expected_evidence as Record<string, unknown>[]) ?? [];
    if (evidenceRaw.length === 0) continue;

    const refs = (r.refs as Record<string, unknown>) ?? {};
    result.push({
      ruleId: String(r.stable_id ?? r.id ?? ''),
      ruleTitle: String(r.title ?? r.summary ?? ''),
      sectionId: String(refs.primary_section ?? refs.section_id ?? ''),
      expectedEvidence: evidenceRaw.map((e: Record<string, unknown>) => ({
        id: String(e.id ?? ''),
        label: String(e.label ?? ''),
        description: String(e.description ?? ''),
        required: Boolean(e.required ?? false),
      })),
    });
  }

  return result;
}

export function loadExportMetadata(provider: string): ExportMetadata | null {
  const exportPath = path.join(providerDir(provider), '_export', 'export-metadata.json');
  const data = loadJson(exportPath);
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  const taxonomyRaw = record.section_taxonomy;
  const taxonomy: ExportSectionTaxonomy[] = Array.isArray(taxonomyRaw)
    ? (taxonomyRaw as Record<string, unknown>[]).map((entry) => ({
        id: String(entry.id ?? ''),
        title: String(entry.title ?? ''),
        description: String(entry.description ?? ''),
        required: Boolean(entry.required ?? false),
        export_order: Number(entry.export_order ?? 0),
        parent_id: (entry.parent_id ?? null) as string | null,
        evidence_categories: Array.isArray(entry.evidence_categories)
          ? (entry.evidence_categories as string[])
          : [],
      }))
    : [];

  return {
    standard: String(record.standard ?? ''),
    metadata_version: String(record.metadata_version ?? ''),
    last_updated: String(record.last_updated ?? ''),
    section_taxonomy: taxonomy,
  };
}

export function loadReviewGradeContract(
  provider: string,
  category: string,
  code: string,
  version: string,
): ReviewGradeContract | null {
  const dir = methodDir(provider, category, code, version);
  if (!fs.existsSync(dir)) return null;

  const meta = loadMethodMeta(dir);
  if (!meta) return null;

  const adoptionStatus = loadAdoptionStatus(dir);
  const reviewGrade = isReviewGrade(adoptionStatus);
  const expectedEvidence = loadExpectedEvidence(dir);
  const taxonomy = loadEvidenceTaxonomy();
  const exportMetadata = loadExportMetadata(provider);

  return {
    provider,
    methodCode: code,
    version,
    category,
    adoptionStatus,
    isReviewGrade: reviewGrade,
    expectedEvidence,
    taxonomy,
    exportMetadata,
  };
}
