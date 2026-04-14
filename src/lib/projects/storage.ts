import type { Project, RuleReview, ProjectCoverage, RuleReviewStatus } from './types';

const STORAGE_KEY = 'article6_projects';

function generateId(): string {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadAll(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
  aoiLabel?: string;
  description?: string;
  ruleIds: Array<{ id: string; title: string; sectionId: string }>;
}): Project {
  const project: Project = {
    id: generateId(),
    name: input.name,
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    aoiLabel: input.aoiLabel,
    description: input.description,
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

  const review = project.reviews.find(r => r.ruleId === ruleId);
  if (!review) return undefined;

  Object.assign(review, update);
  if (update.status === 'verified' || update.status === 'gap') {
    review.reviewedAt = new Date().toISOString();
  }

  saveAll(projects);
  return project;
}

export function finalizeProject(projectId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project) return undefined;

  project.status = 'finalized';
  project.finalizedAt = new Date().toISOString();
  saveAll(projects);
  return project;
}

export function deleteProject(projectId: string): void {
  const projects = loadAll().filter(p => p.id !== projectId);
  saveAll(projects);
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
