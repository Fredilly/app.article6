import type {
  ExtractedManualFindingDraft,
  ManualFinding,
  ManualFindingClosureStatus,
  Project,
  ProjectCoverage,
  ProjectDocument,
  RuleReview,
  RuleReviewStatus,
} from './types';

const STORAGE_KEY = 'article6_projects';

function generateId(): string {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadAll(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProjects(JSON.parse(raw)) : [];
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
  reviewMode: Project['reviewMode'];
  methodCode?: string;
  methodVersion?: string;
  registry?: Project['registry'];
  aoiLabel?: string;
  description?: string;
  ruleIds?: Array<{ id: string; title: string; sectionId: string }>;
}): Project {
  const project: Project = {
    id: generateId(),
    name: input.name,
    reviewMode: input.reviewMode,
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
    registry: input.registry,
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    aoiLabel: input.aoiLabel,
    description: input.description,
    reviews: (input.ruleIds ?? []).map(r => ({
      ruleId: r.id,
      ruleTitle: r.title,
      sectionId: r.sectionId,
      status: 'not-started' as RuleReviewStatus,
      evidenceIds: [],
    })),
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
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

export function getProjectCoverage(project: Project): ProjectCoverage {
  if (project.reviewMode === 'manual') {
    const total = project.manualFindings.length;
    const verified = project.manualFindings.filter(f => f.closureStatus === 'closed').length;
    const gap = project.manualFindings.filter(f => f.closureStatus === 'open').length;
    const inProgress = project.manualFindings.filter(f => f.closureStatus === 'in-review').length;
    const notStarted = 0;
    const notApplicable = 0;
    const percentComplete = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, gap, notStarted, notApplicable, inProgress, percentComplete };
  }

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

export function addProjectDocument(
  projectId: string,
  document: Omit<ProjectDocument, 'id' | 'uploadedAt'>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  project.documents.push({
    id: generateId(),
    uploadedAt: new Date().toISOString(),
    ...document,
  });

  saveAll(projects);
  return project;
}

export function deleteProjectDocument(projectId: string, documentId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  project.documents = project.documents.filter(document => document.id !== documentId);
  project.manualFindings = project.manualFindings.map(finding => (
    finding.sourceDocumentId === documentId
      ? { ...finding, sourceDocumentId: undefined, updatedAt: new Date().toISOString() }
      : finding
  ));
  project.extractedManualFindingDrafts = project.extractedManualFindingDrafts.map(finding => (
    finding.sourceDocumentId === documentId
      ? { ...finding, sourceDocumentId: undefined, updatedAt: new Date().toISOString() }
      : finding
  ));

  saveAll(projects);
  return project;
}

export function addManualFinding(
  projectId: string,
  input: Omit<ManualFinding, 'id' | 'createdAt' | 'updatedAt'>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  const now = new Date().toISOString();
  project.manualFindings.push({
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  });

  saveAll(projects);
  return project;
}

export function updateManualFinding(
  projectId: string,
  findingId: string,
  update: Partial<Omit<ManualFinding, 'id' | 'createdAt'>>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  const finding = project.manualFindings.find(item => item.id === findingId);
  if (!finding) return undefined;

  Object.assign(finding, update, { updatedAt: new Date().toISOString() });
  saveAll(projects);
  return project;
}

export function deleteManualFinding(projectId: string, findingId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  project.manualFindings = project.manualFindings.filter(finding => finding.id !== findingId);
  saveAll(projects);
  return project;
}

export function addExtractedManualFindingDrafts(
  projectId: string,
  drafts: Array<Omit<ExtractedManualFindingDraft, 'id' | 'createdAt' | 'updatedAt'>>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  const now = new Date().toISOString();
  for (const draft of drafts) {
    project.extractedManualFindingDrafts.push({
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...draft,
    });
  }

  saveAll(projects);
  return project;
}

export function updateExtractedManualFindingDraft(
  projectId: string,
  draftId: string,
  update: Partial<Omit<ExtractedManualFindingDraft, 'id' | 'createdAt'>>,
): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  const finding = project.extractedManualFindingDrafts.find(item => item.id === draftId);
  if (!finding) return undefined;

  Object.assign(finding, update, { updatedAt: new Date().toISOString() });
  saveAll(projects);
  return project;
}

export function deleteExtractedManualFindingDraft(projectId: string, draftId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  project.extractedManualFindingDrafts = project.extractedManualFindingDrafts.filter(finding => finding.id !== draftId);
  saveAll(projects);
  return project;
}

export function acceptExtractedManualFindingDraft(projectId: string, draftId: string): Project | undefined {
  const projects = loadAll();
  const project = projects.find(p => p.id === projectId);
  if (!project || project.status === 'locked') return undefined;

  const draftIndex = project.extractedManualFindingDrafts.findIndex(item => item.id === draftId);
  if (draftIndex === -1) return undefined;

  const draft = project.extractedManualFindingDrafts[draftIndex];
  if (!draft.findingId.trim() || !draft.findingType) return undefined;

  const now = new Date().toISOString();
  project.manualFindings.push({
    id: generateId(),
    findingId: draft.findingId.trim(),
    findingType: draft.findingType,
    requirement: draft.requirement,
    description: draft.description,
    sourceDocumentId: draft.sourceDocumentId,
    sourcePageRange: draft.sourcePageRange,
    evidenceExcerpt: draft.evidenceExcerpt,
    projectResponse: draft.projectResponse,
    documentationSubmitted: draft.documentationSubmitted,
    auditTeamEvaluation: draft.auditTeamEvaluation,
    closureStatus: draft.closureStatus ?? 'in-review',
    reviewerNote: draft.reviewerNote,
    createdAt: now,
    updatedAt: now,
  });
  project.extractedManualFindingDrafts.splice(draftIndex, 1);

  saveAll(projects);
  return project;
}

function normalizeProjects(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => normalizeProject(item as Partial<Project>));
}

function normalizeProject(project: Partial<Project>): Project {
  return {
    id: project.id ?? generateId(),
    name: project.name ?? 'Untitled project',
    reviewMode: project.reviewMode ?? 'methodology-linked',
    methodCode: project.methodCode,
    methodVersion: project.methodVersion,
    registry: project.registry,
    status: project.status ?? 'in-progress',
    createdAt: project.createdAt ?? new Date().toISOString(),
    lockedAt: project.lockedAt,
    aoiLabel: project.aoiLabel,
    description: project.description,
    reviews: Array.isArray(project.reviews) ? project.reviews : [],
    documents: Array.isArray(project.documents) ? project.documents : [],
    manualFindings: Array.isArray(project.manualFindings) ? project.manualFindings : [],
    extractedManualFindingDrafts: Array.isArray(project.extractedManualFindingDrafts) ? project.extractedManualFindingDrafts : [],
  };
}

export function nextManualFindingId(project: Project): string {
  const max = project.manualFindings.reduce((currentMax, finding) => {
    const match = finding.findingId.match(/(\d+)$/);
    const numeric = match ? Number(match[1]) : 0;
    return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax;
  }, 0);
  return `F-${String(max + 1).padStart(3, '0')}`;
}

export function manualFindingClosureLabel(status: ManualFindingClosureStatus): string {
  if (status === 'open') return 'Open';
  if (status === 'in-review') return 'In Review';
  return 'Closed';
}
