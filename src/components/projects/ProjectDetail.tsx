'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type {
  ExtractedManualFindingDraft,
  ManualFinding,
  ManualFindingClosureStatus,
  ManualFindingType,
  Project,
  ProjectCoverage,
  ProjectDocument,
  RuleReview,
} from '@/lib/projects/types';
import {
  acceptExtractedManualFindingDraft,
  addExtractedManualFindingDrafts,
  addManualFinding,
  addProjectDocument,
  deleteExtractedManualFindingDraft,
  deleteManualFinding,
  deleteProjectDocument,
  getProject,
  getProjectCoverage,
  lockProject,
  manualFindingClosureLabel,
  nextManualFindingId,
  updateManualFinding,
  updateRuleReview,
  updateExtractedManualFindingDraft,
} from '@/lib/projects/storage';

type ProjectDetailProps = {
  projectId: string;
};

type ManualFindingDraft = {
  findingId: string;
  findingType: ManualFindingType;
  sourceDocumentId: string;
  evidenceExcerpt: string;
  projectResponse: string;
  closureStatus: ManualFindingClosureStatus;
  reviewerNote: string;
};

type ExtractedManualFindingDraftField = keyof Pick<
  ExtractedManualFindingDraft,
  | 'findingId'
  | 'findingType'
  | 'requirement'
  | 'description'
  | 'sourcePageRange'
  | 'evidenceExcerpt'
  | 'projectResponse'
  | 'documentationSubmitted'
  | 'auditTeamEvaluation'
  | 'closureStatus'
  | 'reviewerNote'
>;

const EMPTY_MANUAL_FINDING: ManualFindingDraft = {
  findingId: '',
  findingType: 'VVB finding',
  sourceDocumentId: '',
  evidenceExcerpt: '',
  projectResponse: '',
  closureStatus: 'open',
  reviewerNote: '',
};

export function shouldShowLockReview(project: Project, coverage: ProjectCoverage | null): boolean {
  if (project.status !== 'in-progress' || !coverage) return false;
  if (project.reviewMode === 'manual') return project.manualFindings.length > 0;
  return coverage.notStarted < coverage.total;
}

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [coverage, setCoverage] = useState<ProjectCoverage | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualFindingDraft>(EMPTY_MANUAL_FINDING);

  useEffect(() => {
    const p = getProject(projectId);
    if (p) {
      setProject(p);
      setCoverage(getProjectCoverage(p));
      setManualDraft((current) => ({
        ...current,
        findingId: current.findingId || nextManualFindingId(p),
      }));
    }
  }, [projectId]);

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-slate-500">Project not found.</p>
        <Link href="/projects" className="mt-2 text-sm text-blue-600 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const refreshProject = (nextProject: Project | undefined) => {
    if (!nextProject) return;
    setProject(nextProject);
    setCoverage(getProjectCoverage(nextProject));
    if (nextProject.reviewMode === 'manual') {
      setManualDraft({
        ...EMPTY_MANUAL_FINDING,
        findingId: nextManualFindingId(nextProject),
      });
    }
  };

  const handleStatusChange = (ruleId: string, status: RuleReview['status']) => {
    refreshProject(updateRuleReview(projectId, ruleId, { status }));
  };

  const handleLock = () => {
    const locked = lockProject(projectId);
    if (locked) {
      setProject(locked);
      setCoverage(getProjectCoverage(locked));
    }
  };

  const handleDownloadPack = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/projects/' + projectId + '/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      if (!res.ok) throw new Error('Pack generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = project.reviewMode === 'manual'
        ? `manual-review-pack-${project.id.slice(0, 8)}.pdf`
        : `verification-pack-${project.methodCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate PDF: ' + String(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      let extractedText = '';
      let extractionStatus: ProjectDocument['manualFindingExtractionStatus'] = 'not-run';
      let extractionMessage = '';
      let extractedDrafts: Array<Omit<ExtractedManualFindingDraft, 'id' | 'createdAt' | 'updatedAt' | 'sourceDocumentId'>> = [];
      if ((file.type || '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const response = await fetch('/api/projects/manual-review/extract-findings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/pdf',
              'x-article6-filename': encodeURIComponent(file.name),
            },
            body: await file.arrayBuffer(),
          });
          const data = await response.json();
          extractedText = typeof data.text === 'string' ? data.text.slice(0, 2000) : '';
          extractedDrafts = Array.isArray(data.drafts) ? data.drafts : [];
          extractionStatus = data.extractionFailed
            ? 'extraction-failed'
            : extractedDrafts.length > 0
              ? 'extracted'
              : 'no-findings';
          extractionMessage = typeof data.message === 'string'
            ? data.message
            : 'No structured CAR/CL/FAR findings detected. You can still add findings manually.';
        } catch {
          extractedText = '';
          extractionStatus = 'extraction-failed';
          extractionMessage = 'Could not extract findings from this PDF. You can still add findings manually.';
        }
      }

      const updatedProject = addProjectDocument(projectId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        extractedText,
        manualFindingExtractionStatus: extractionStatus,
        manualFindingExtractionMessage: extractionMessage || undefined,
      });
      refreshProject(updatedProject);

      const documentId = updatedProject?.documents[updatedProject.documents.length - 1]?.id;
      if (documentId && extractedDrafts.length > 0) {
        refreshProject(addExtractedManualFindingDrafts(projectId, extractedDrafts.map((draft) => ({
          ...draft,
          sourceDocumentId: documentId,
        }))));
      }
    }

    event.target.value = '';
    setUploading(false);
  };

  const handleCreateManualFinding = (event: FormEvent) => {
    event.preventDefault();
    if (!manualDraft.findingId.trim()) return;

    refreshProject(addManualFinding(projectId, {
      findingId: manualDraft.findingId.trim(),
      findingType: manualDraft.findingType,
      sourceDocumentId: manualDraft.sourceDocumentId || undefined,
      evidenceExcerpt: manualDraft.evidenceExcerpt.trim() || undefined,
      projectResponse: manualDraft.projectResponse.trim() || undefined,
      closureStatus: manualDraft.closureStatus,
      reviewerNote: manualDraft.reviewerNote.trim() || undefined,
    }));
  };

  const updateFindingField = (
    findingId: string,
    field: keyof Pick<ManualFinding, 'findingType' | 'requirement' | 'description' | 'sourceDocumentId' | 'sourcePageRange' | 'evidenceExcerpt' | 'projectResponse' | 'documentationSubmitted' | 'auditTeamEvaluation' | 'closureStatus' | 'reviewerNote'>,
    value: string,
  ) => {
    if (field === 'findingType') {
      refreshProject(updateManualFinding(projectId, findingId, { findingType: value as ManualFindingType }));
      return;
    }
    if (field === 'closureStatus') {
      refreshProject(updateManualFinding(projectId, findingId, { closureStatus: value as ManualFindingClosureStatus }));
      return;
    }
    refreshProject(updateManualFinding(projectId, findingId, {
      [field]: value || undefined,
    } as Partial<Omit<ManualFinding, 'id' | 'createdAt'>>));
  };

  const updateExtractedDraftField = (
    draftId: string,
    field: ExtractedManualFindingDraftField,
    value: string,
  ) => {
    if (field === 'findingType') {
      refreshProject(updateExtractedManualFindingDraft(projectId, draftId, {
        findingType: value ? value as ExtractedManualFindingDraft['findingType'] : undefined,
        extractionStatus: value ? 'draft' : 'needs-review',
        extractionMessage: value ? 'draft' : 'needs review',
      }));
      return;
    }
    if (field === 'closureStatus') {
      refreshProject(updateExtractedManualFindingDraft(projectId, draftId, {
        closureStatus: value ? value as ManualFindingClosureStatus : undefined,
      }));
      return;
    }
    const normalizedValue = value || undefined;
    refreshProject(updateExtractedManualFindingDraft(projectId, draftId, {
      [field]: normalizedValue,
      ...(field === 'findingId' && !value ? {
        extractionStatus: 'needs-review' as const,
        extractionMessage: 'needs review',
      } : {}),
    } as Partial<Omit<ExtractedManualFindingDraft, 'id' | 'createdAt'>>));
  };

  const latestNoFindingsMessage = project.documents
    .slice()
    .reverse()
    .find((document) => document.manualFindingExtractionStatus === 'no-findings' || document.manualFindingExtractionStatus === 'extraction-failed')
    ?.manualFindingExtractionMessage;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 md:px-8">
      <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
              {project.reviewMode === 'manual' ? 'Manual Review' : 'Methodology-linked review'}
            </span>
            {project.reviewMode === 'methodology-linked' && project.methodCode && project.methodVersion ? (
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
                {project.methodCode}@{project.methodVersion}
              </span>
            ) : null}
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                project.status === 'locked'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {project.status}
            </span>
          </div>
          {project.aoiLabel ? <p className="mt-1 text-sm text-slate-400">Project area: {project.aoiLabel}</p> : null}
          {project.description ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{project.description}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {shouldShowLockReview(project, coverage) ? (
            <button
              onClick={handleLock}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Lock Review
            </button>
          ) : null}
          {project.status === 'locked' ? (
            <button
              onClick={handleDownloadPack}
              disabled={downloading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {downloading ? 'Generating...' : 'Download Export'}
            </button>
          ) : null}
        </div>
      </div>

      {coverage ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {project.reviewMode === 'manual'
              ? [
                { label: 'Closed', value: coverage.verified, color: 'text-green-600' },
                { label: 'Open', value: coverage.gap, color: 'text-red-600' },
                { label: 'In Review', value: coverage.inProgress, color: 'text-amber-600' },
                { label: 'Documents', value: project.documents.length, color: 'text-slate-700' },
                { label: 'Findings', value: coverage.total, color: 'text-slate-900' },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))
              : [
                { label: 'Verified', value: coverage.verified, color: 'text-green-600' },
                { label: 'Gaps', value: coverage.gap, color: 'text-red-600' },
                { label: 'In Progress', value: coverage.inProgress, color: 'text-amber-600' },
                { label: 'Pending', value: coverage.notStarted, color: 'text-slate-400' },
                { label: 'N/A', value: coverage.notApplicable, color: 'text-slate-300' },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))}
          </div>

          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${coverage.percentComplete}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-500">{coverage.percentComplete}% complete</p>
          </div>
        </>
      ) : null}

      {project.reviewMode === 'manual' ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Source Documents</h2>
                <p className="mt-1 text-sm text-slate-500">Upload project documents used in manual findings reconstruction.</p>
              </div>
              {project.status === 'in-progress' ? (
                <label className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  {uploading ? 'Uploading...' : 'Upload Documents'}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleUploadDocuments}
                    disabled={uploading}
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {project.documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No source documents uploaded yet.
                </div>
              ) : project.documents.map((document: ProjectDocument) => (
                <div key={document.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{document.fileName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {document.mimeType} · {document.sizeBytes} bytes · {new Date(document.uploadedAt).toLocaleString()}
                      </div>
                    </div>
                    {project.status === 'in-progress' ? (
                      <button
                        onClick={() => refreshProject(deleteProjectDocument(projectId, document.id))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {document.extractedText?.trim() ? (
                    <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {document.extractedText.slice(0, 280)}
                    </p>
                  ) : null}
                  {document.manualFindingExtractionMessage ? (
                    <p className={`mt-2 text-xs ${
                      document.manualFindingExtractionStatus === 'extraction-failed'
                        ? 'text-red-600'
                        : document.manualFindingExtractionStatus === 'no-findings'
                          ? 'text-slate-500'
                        : 'text-blue-600'
                    }`}>
                      {document.manualFindingExtractionMessage}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Extraction Review</h2>
              <p className="mt-1 text-sm text-slate-500">Review extracted CAR, CL, and FAR drafts before adding them to Manual Findings.</p>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {project.extractedManualFindingDrafts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {latestNoFindingsMessage || 'Upload a VVB report appendix to extract draft CAR/CL/FAR findings.'}
                </div>
              ) : project.extractedManualFindingDrafts.map((draft) => {
                const sourceDocument = project.documents.find((document) => document.id === draft.sourceDocumentId);
                return (
                  <div key={draft.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{draft.findingId || 'Draft finding'}</div>
                          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            draft.extractionStatus === 'draft'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {draft.extractionStatus === 'draft' ? 'Draft' : 'Needs review'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {draft.findingType || 'Type not confirmed'} · {sourceDocument?.fileName || 'No source document'}{draft.sourcePageRange ? ` · p.${draft.sourcePageRange}` : ''}
                        </div>
                      </div>

                      {project.status === 'in-progress' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => refreshProject(acceptExtractedManualFindingDraft(projectId, draft.id))}
                            disabled={!draft.findingId.trim() || !draft.findingType}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => refreshProject(deleteExtractedManualFindingDraft(projectId, draft.id))}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">{draft.extractionMessage}</div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Finding ID">
                        <EditableInput
                          readOnly={project.status !== 'in-progress'}
                          value={draft.findingId}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'findingId', value)}
                        />
                      </Field>
                      <Field label="Finding Type">
                        {project.status === 'in-progress' ? (
                          <select
                            value={draft.findingType || ''}
                            onChange={(event) => updateExtractedDraftField(draft.id, 'findingType', event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Needs review...</option>
                            <option value="CAR">CAR</option>
                            <option value="CL">CL</option>
                            <option value="FAR">FAR</option>
                          </select>
                        ) : (
                          <StaticValue value={draft.findingType || 'Needs review'} />
                        )}
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Source Document">
                        <StaticValue value={sourceDocument?.fileName || 'No source document linked'} />
                      </Field>
                      <Field label="Page Number / Range">
                        <EditableInput
                          readOnly={project.status !== 'in-progress'}
                          value={draft.sourcePageRange || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'sourcePageRange', value)}
                          placeholder="e.g., 120-121"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <Field label="Requirement">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.requirement || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'requirement', value)}
                        />
                      </Field>
                      <Field label="Description">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.description || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'description', value)}
                        />
                      </Field>
                      <Field label="Project Response">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.projectResponse || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'projectResponse', value)}
                        />
                      </Field>
                      <Field label="Documentation Submitted">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.documentationSubmitted || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'documentationSubmitted', value)}
                        />
                      </Field>
                      <Field label="Audit Team Evaluation">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.auditTeamEvaluation || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'auditTeamEvaluation', value)}
                        />
                      </Field>
                      <Field label="Closure Status">
                        {project.status === 'in-progress' ? (
                          <select
                            value={draft.closureStatus || ''}
                            onChange={(event) => updateExtractedDraftField(draft.id, 'closureStatus', event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Needs review...</option>
                            <option value="open">Open</option>
                            <option value="in-review">In Review</option>
                            <option value="closed">Closed</option>
                          </select>
                        ) : (
                          <StaticValue value={draft.closureStatus || 'Needs review'} />
                        )}
                      </Field>
                      <Field label="Source Excerpt">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={draft.evidenceExcerpt || ''}
                          onChange={(value) => updateExtractedDraftField(draft.id, 'evidenceExcerpt', value)}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Manual Findings</h2>
              <p className="mt-1 text-sm text-slate-500">Track CAR, CL, FAR, VVB findings, evidence gaps, responses, and reviewer notes.</p>
            </div>

            {project.status === 'in-progress' ? (
              <form onSubmit={handleCreateManualFinding} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Finding ID</label>
                    <input
                      type="text"
                      value={manualDraft.findingId}
                      onChange={(event) => setManualDraft((current) => ({ ...current, findingId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Finding Type</label>
                    <select
                      value={manualDraft.findingType}
                      onChange={(event) => setManualDraft((current) => ({ ...current, findingType: event.target.value as ManualFindingType }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="CAR">CAR</option>
                      <option value="CL">CL</option>
                      <option value="FAR">FAR</option>
                      <option value="VVB finding">VVB finding</option>
                      <option value="evidence gap">evidence gap</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Source Document</label>
                    <select
                      value={manualDraft.sourceDocumentId}
                      onChange={(event) => setManualDraft((current) => ({ ...current, sourceDocumentId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select a source document...</option>
                      {project.documents.map(document => (
                        <option key={document.id} value={document.id}>
                          {document.fileName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Closure Status</label>
                    <select
                      value={manualDraft.closureStatus}
                      onChange={(event) => setManualDraft((current) => ({ ...current, closureStatus: event.target.value as ManualFindingClosureStatus }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="in-review">In Review</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence Excerpt</label>
                  <textarea
                    rows={3}
                    value={manualDraft.evidenceExcerpt}
                    onChange={(event) => setManualDraft((current) => ({ ...current, evidenceExcerpt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Project Response</label>
                  <textarea
                    rows={3}
                    value={manualDraft.projectResponse}
                    onChange={(event) => setManualDraft((current) => ({ ...current, projectResponse: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer Note</label>
                  <textarea
                    rows={3}
                    value={manualDraft.reviewerNote}
                    onChange={(event) => setManualDraft((current) => ({ ...current, reviewerNote: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Add Review Item
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 flex flex-col gap-4">
              {project.manualFindings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No manual review items yet.
                </div>
              ) : project.manualFindings.map((finding) => {
                const sourceDocument = project.documents.find((document) => document.id === finding.sourceDocumentId);
                return (
                  <div key={finding.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{finding.findingId}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {finding.findingType} · {manualFindingClosureLabel(finding.closureStatus)} · {sourceDocument?.fileName || 'No source document'}{finding.sourcePageRange ? ` · p.${finding.sourcePageRange}` : ''}
                        </div>
                      </div>
                      {project.status === 'in-progress' ? (
                        <button
                          onClick={() => refreshProject(deleteManualFinding(projectId, finding.id))}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Finding Type">
                        {project.status === 'in-progress' ? (
                          <select
                            value={finding.findingType}
                            onChange={(event) => updateFindingField(finding.id, 'findingType', event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="CAR">CAR</option>
                            <option value="CL">CL</option>
                            <option value="FAR">FAR</option>
                            <option value="VVB finding">VVB finding</option>
                            <option value="evidence gap">evidence gap</option>
                          </select>
                        ) : (
                          <StaticValue value={finding.findingType} />
                        )}
                      </Field>

                      <Field label="Closure Status">
                        {project.status === 'in-progress' ? (
                          <select
                            value={finding.closureStatus}
                            onChange={(event) => updateFindingField(finding.id, 'closureStatus', event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in-review">In Review</option>
                            <option value="closed">Closed</option>
                          </select>
                        ) : (
                          <StaticValue value={manualFindingClosureLabel(finding.closureStatus)} />
                        )}
                      </Field>
                    </div>

                    <div className="mt-3">
                      <Field label="Source Document">
                        {project.status === 'in-progress' ? (
                          <select
                            value={finding.sourceDocumentId || ''}
                            onChange={(event) => updateFindingField(finding.id, 'sourceDocumentId', event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Select a source document...</option>
                            {project.documents.map(document => (
                              <option key={document.id} value={document.id}>
                                {document.fileName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StaticValue value={sourceDocument?.fileName || 'No source document linked'} />
                        )}
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <Field label="Requirement">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.requirement || ''}
                          onChange={(value) => updateFindingField(finding.id, 'requirement', value)}
                        />
                      </Field>
                      <Field label="Description">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.description || ''}
                          onChange={(value) => updateFindingField(finding.id, 'description', value)}
                        />
                      </Field>
                      <Field label="Page Number / Range">
                        <EditableInput
                          readOnly={project.status !== 'in-progress'}
                          value={finding.sourcePageRange || ''}
                          onChange={(value) => updateFindingField(finding.id, 'sourcePageRange', value)}
                          placeholder="e.g., 120-121"
                        />
                      </Field>
                      <Field label="Evidence Excerpt">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.evidenceExcerpt || ''}
                          onChange={(value) => updateFindingField(finding.id, 'evidenceExcerpt', value)}
                        />
                      </Field>
                      <Field label="Project Response">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.projectResponse || ''}
                          onChange={(value) => updateFindingField(finding.id, 'projectResponse', value)}
                        />
                      </Field>
                      <Field label="Documentation Submitted">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.documentationSubmitted || ''}
                          onChange={(value) => updateFindingField(finding.id, 'documentationSubmitted', value)}
                        />
                      </Field>
                      <Field label="Audit Team Evaluation">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.auditTeamEvaluation || ''}
                          onChange={(value) => updateFindingField(finding.id, 'auditTeamEvaluation', value)}
                        />
                      </Field>
                      <Field label="Reviewer Note">
                        <EditableText
                          readOnly={project.status !== 'in-progress'}
                          value={finding.reviewerNote || ''}
                          onChange={(value) => updateFindingField(finding.id, 'reviewerNote', value)}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <MethodologyLinkedReview project={project} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}

function MethodologyLinkedReview({
  project,
  onStatusChange,
}: {
  project: Project;
  onStatusChange: (ruleId: string, status: RuleReview['status']) => void;
}) {
  const grouped = project.reviews.reduce((acc, review) => {
    if (!acc[review.sectionId]) acc[review.sectionId] = [];
    acc[review.sectionId].push(review);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  return (
    <>
      {Object.entries(grouped).map(([sectionId, reviews]) => (
        <div key={sectionId} className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-700">{sectionId}</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {reviews.map((review) => (
              <div key={review.ruleId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{review.ruleTitle}</div>
                  <div className="font-mono text-xs text-slate-400">{review.ruleId}</div>
                </div>
                {project.status === 'in-progress' ? (
                  <select
                    value={review.status}
                    onChange={event => onStatusChange(review.ruleId, event.target.value as RuleReview['status'])}
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      review.status === 'verified'
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : review.status === 'gap'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : review.status === 'not-applicable'
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="verified">Verified</option>
                    <option value="gap">Gap</option>
                    <option value="not-applicable">N/A</option>
                  </select>
                ) : (
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      review.status === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : review.status === 'gap'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {review.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function EditableText({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}) {
  if (readOnly) return <StaticValue value={value || 'Not provided'} />;
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
    />
  );
}

function EditableInput({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  if (readOnly) return <StaticValue value={value || 'Not provided'} />;
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
    />
  );
}

function StaticValue({ value }: { value: string }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{value}</div>;
}
