import type {
  Project,
  RuleReview,
  ProjectCoverage,
  RuleReviewStatus,
  ProjectEvidenceIntakeItem,
  ProjectEvidenceIntakeStatus,
  ProjectEvidenceIntakeType,
} from './types';

const STORAGE_KEY = 'article6_projects';
const EVIDENCE_INTAKE_BLUEPRINT: Array<{ type: ProjectEvidenceIntakeType; label: string }> = [
  { type: 'pdd', label: 'PDD' },
  { type: 'monitoring-report', label: 'Monitoring report' },
  { type: 'workbook', label: 'Workbook' },
];

function generateId(): string {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeProjectEvidenceIntake(items: unknown): ProjectEvidenceIntakeItem[] {
  const byType = new Map<ProjectEvidenceIntakeType, ProjectEvidenceIntakeItem>();
  const source = Array.isArray(items) ? items : [];

  for (const raw of source) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<ProjectEvidenceIntakeItem>;
    if (!candidate.type || !EVIDENCE_INTAKE_BLUEPRINT.some((item) => item.type === candidate.type)) continue;
    const type = candidate.type as ProjectEvidenceIntakeType;
    const blueprint = EVIDENCE_INTAKE_BLUEPRINT.find((item) => item.type === type)!;
    const status: ProjectEvidenceIntakeStatus =
      candidate.status === 'supplied' || candidate.status === 'linked' ? candidate.status : 'source-not-supplied';
    byType.set(type, {
      type,
      label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : blueprint.label,
      status,
      sourceName: typeof candidate.sourceName === 'string' && candidate.sourceName.trim() ? candidate.sourceName.trim() : undefined,
      provenanceNote:
        typeof candidate.provenanceNote === 'string' && candidate.provenanceNote.trim() ? candidate.provenanceNote.trim() : undefined,
      updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim() ? candidate.updatedAt : undefined,
    });
  }

  return EVIDENCE_INTAKE_BLUEPRINT.map(({ type, label }) => (
    byType.get(type) ?? {
      type,
      label,
      status: 'source-not-supplied',
    }
  ));
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    evidenceIntake: normalizeProjectEvidenceIntake((project as Partial<Project>).evidenceIntake),
  };
}

function loadAll(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => normalizeProject(item as Project)) : [];
  } catch {
    return [];
  }
}

function saveAll(projects: Project[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects(): Project[] {
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(id: string): Project | undefined {
  return loadAll().find(p => p.id === id);
}

export function createProject(input: {
  name: string;
  methodCode: string;
  methodVersion: string;
  registry?: Project['registry'];
  aoiLabel?: string;
  description?: string;
  ruleIds: Array<{ id: string; title: string; sectionId: string }>;
}): Project {
  const project: Project = {
    id: generateId(),
    name: input.name,
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
    registry: input.registry,
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    aoiLabel: input.aoiLabel,
    description: input.description,
    evidenceIntake: normalizeProjectEvidenceIntake(undefined),
    reviews: input.ruleIds.map(r => ({
      ruleId: r.id,
      ruleTitle: r.title,
      sectionId: r.sectionId,
      status: 'not-started' as RuleReviewStatus,
      evidenceIds: [],
    })),
  };

  const projects = loadAll();
  projects.push(project);
  saveAll(projects);
  return project;
}

export function updateRuleReview(
  projectId: string,
  ruleId: string,
  update: Partial<RuleReview>
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project) return undefined;

  if (project.status === 'locked') return undefined;

  const review = project.reviews.find(r => r.ruleId === ruleId);
  if (!review) return undefined;

  Object.assign(review, update);
  if (update.status === 'verified' || update.status === 'gap') {
    review.reviewedAt = new Date().toISOString();
  }

  saveAll(projects);
  return project;
}

export function lockProject(projectId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project) return undefined;

  project.status = 'locked';
  project.lockedAt = new Date().toISOString();
  saveAll(projects);
  return project;
}

export function deleteProject(projectId: string): void {
  const projects = loadAll().filter(p => p.id !== projectId);
  saveAll(projects);
}

export function updateProjectEvidenceIntake(
  projectId: string,
  type: ProjectEvidenceIntakeType,
  update: Partial<Pick<ProjectEvidenceIntakeItem, 'status' | 'sourceName' | 'provenanceNote'>>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return undefined;
  if (project.status === 'locked') return undefined;

  const nextEvidenceIntake = normalizeProjectEvidenceIntake(project.evidenceIntake).map((item) => {
    if (item.type !== type) return item;
    return {
      ...item,
      status: update.status ?? item.status,
      sourceName: update.sourceName?.trim() ? update.sourceName.trim() : undefined,
      provenanceNote: update.provenanceNote?.trim() ? update.provenanceNote.trim() : undefined,
      updatedAt: new Date().toISOString(),
    };
  });

  project.evidenceIntake = nextEvidenceIntake;
  saveAll(projects);
  return project;
}

export function getProjectCoverage(project: Project): ProjectCoverage {
  const reviews = project.reviews;
  const total = reviews.length;
  const verified = reviews.filter(r => r.status === 'verified').length;
  const gap = reviews.filter(r => r.status === 'gap').length;
  const notStarted = reviews.filter(r => r.status === 'not-started').length;
  const notApplicable = reviews.filter(r => r.status === 'not-applicable').length;
  const inProgress = reviews.filter(r => r.status === 'in-progress').length;
  const actionable = total - notApplicable;
  const percentComplete = actionable > 0 ? Math.round(((verified + gap) / actionable) * 100) : 0;

  return { total, verified, gap, notStarted, notApplicable, inProgress, percentComplete };
}
