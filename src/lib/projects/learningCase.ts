import { MANUAL_REVIEW_LIMITATION, manualRegistryLabel } from '@/lib/projects/verificationReport';
import type { LearningCase, LearningCaseTrigger, Project } from '@/lib/projects/types';

const RETENTION_POLICY =
  'No raw document text, full source excerpts, or uploaded file bytes are retained. Learning cases store only redacted metadata and structured quality signals.';

function generateLearningCaseId(): string {
  return `lc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function countPresent(values: Array<string | undefined>): number {
  return values.filter((value) => Boolean(value?.trim())).length;
}

function manualDocumentTypeLabel(project: Project): string {
  if (project.documents.some((document) => document.mimeType === 'application/pdf')) {
    return 'Published verification report PDF';
  }
  if (project.documents.length > 0) return 'Uploaded source document';
  return 'Not provided';
}

function manualMethodologyWired(project: Project): boolean {
  return Boolean(project.methodCode?.trim() && project.methodVersion?.trim());
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export function manualReviewLearningCaseDedupKey(
  project: Project,
  trigger: LearningCaseTrigger,
): string {
  const registryLabel = manualRegistryLabel(project);
  const documentFingerprints = project.documents
    .map((document) => [
      document.fileName,
      document.mimeType,
      String(document.sizeBytes),
      document.manualFindingExtractionStatus ?? 'not-run',
    ].join('|'))
    .sort();
  const findingFingerprints = project.manualFindings
    .map((finding) => [
      finding.findingId,
      finding.findingType,
      finding.closureStatus,
      finding.sourcePageRange?.trim() || '',
      Boolean(finding.requirement?.trim()),
      Boolean(finding.description?.trim()),
      Boolean(finding.projectResponse?.trim()),
      Boolean(finding.documentationSubmitted?.trim()),
      Boolean(finding.auditTeamEvaluation?.trim()),
      Boolean(finding.reviewerNote?.trim()),
    ].join('|'))
    .sort();
  const draftFingerprints = project.extractedManualFindingDrafts
    .map((draft) => [
      draft.findingId.trim(),
      draft.findingType ?? '',
      draft.extractionStatus,
      draft.closureStatus ?? '',
      Boolean(draft.reviewerNote?.trim()),
    ].join('|'))
    .sort();

  return JSON.stringify({
    trigger,
    status: project.status,
    lockedAt: project.lockedAt ?? '',
    registryLabel,
    methodology: project.methodCode && project.methodVersion ? `${project.methodCode}@${project.methodVersion}` : '',
    projectArea: Boolean(project.aoiLabel?.trim()),
    projectDescription: Boolean(project.description?.trim()),
    documentFingerprints,
    findingFingerprints,
    draftFingerprints,
  });
}

export function buildManualReviewLearningCase(
  project: Project,
  trigger: LearningCaseTrigger,
  createdAt = new Date().toISOString(),
): LearningCase {
  const registryLabel = manualRegistryLabel(project);
  const dedupKey = manualReviewLearningCaseDedupKey(project, trigger);
  const findingTypeCounts = project.manualFindings.reduce(
    (counts, finding) => {
      if (finding.findingType === 'CAR' || finding.findingType === 'CL' || finding.findingType === 'FAR') {
        counts[finding.findingType] += 1;
      } else {
        counts.other += 1;
      }
      return counts;
    },
    { CAR: 0, CL: 0, FAR: 0, other: 0 },
  );

  const closureCounts = project.manualFindings.reduce(
    (counts, finding) => {
      counts[finding.closureStatus] += 1;
      return counts;
    },
    { open: 0, 'in-review': 0, closed: 0 },
  );

  const fieldsPresent = {
    registry_or_standard: registryLabel !== 'Unknown registry' ? 1 : 0,
    methodology_reference: manualMethodologyWired(project) ? 1 : 0,
    project_area: project.aoiLabel?.trim() ? 1 : 0,
    project_description: project.description?.trim() ? 1 : 0,
    source_page_range: countPresent(project.manualFindings.map((finding) => finding.sourcePageRange)),
    requirement: countPresent(project.manualFindings.map((finding) => finding.requirement)),
    description: countPresent(project.manualFindings.map((finding) => finding.description)),
    project_response: countPresent(project.manualFindings.map((finding) => finding.projectResponse)),
    documentation_submitted: countPresent(project.manualFindings.map((finding) => finding.documentationSubmitted)),
    audit_team_evaluation: countPresent(project.manualFindings.map((finding) => finding.auditTeamEvaluation)),
    reviewer_note: countPresent(project.manualFindings.map((finding) => finding.reviewerNote)),
    closure_status: project.manualFindings.length,
  };

  const totalFindings = project.manualFindings.length;
  const fieldsMissing = {
    registry_or_standard: fieldsPresent.registry_or_standard ? 0 : 1,
    methodology_reference: fieldsPresent.methodology_reference ? 0 : 1,
    project_area: fieldsPresent.project_area ? 0 : 1,
    project_description: fieldsPresent.project_description ? 0 : 1,
    source_page_range: Math.max(0, totalFindings - fieldsPresent.source_page_range),
    requirement: Math.max(0, totalFindings - fieldsPresent.requirement),
    description: Math.max(0, totalFindings - fieldsPresent.description),
    project_response: Math.max(0, totalFindings - fieldsPresent.project_response),
    documentation_submitted: Math.max(0, totalFindings - fieldsPresent.documentation_submitted),
    audit_team_evaluation: Math.max(0, totalFindings - fieldsPresent.audit_team_evaluation),
    reviewer_note: Math.max(0, totalFindings - fieldsPresent.reviewer_note),
    closure_status: 0,
  };

  const exportQualityFlags = uniqueSorted([
    ...(registryLabel === 'Unknown registry' ? ['metadata_missing_registry_or_standard'] : []),
    ...(!manualMethodologyWired(project) ? ['metadata_missing_methodology_reference'] : []),
    ...(!project.aoiLabel?.trim() ? ['metadata_missing_project_area'] : []),
    ...(!project.description?.trim() ? ['metadata_missing_project_description'] : []),
    ...(project.documents.length === 0 ? ['source_document_set_missing'] : []),
    ...(project.manualFindings.length === 0 ? ['manual_findings_missing'] : []),
    ...(project.documents.some((document) => document.manualFindingExtractionStatus === 'extraction-failed')
      ? ['document_extraction_failed']
      : []),
    ...(project.documents.some((document) => document.manualFindingExtractionStatus === 'no-findings')
      ? ['document_extraction_returned_no_findings']
      : []),
    ...(project.extractedManualFindingDrafts.length > 0 ? ['draft_findings_pending_review'] : []),
  ]);

  const truthRulesTriggered = [
    'manual_review_reconstruction_only',
    'user_entered_unverified',
    'training_disabled_for_learning_case',
    'human_review_required',
    'no_independent_verification_opinion',
    'no_validation_statement',
    'no_methodology_compliance_determination',
    'no_customer_source_document_retention',
    `limitation_text:${MANUAL_REVIEW_LIMITATION}`,
  ];

  const recommendedEvals = uniqueSorted([
    'manual-review-finding-type-summary',
    'manual-review-closure-counts',
    'manual-review-field-coverage',
    'manual-review-truthfulness-language',
    'manual-review-source-retention',
    ...(registryLabel === 'Unknown registry' ? ['manual-review-registry-inference'] : []),
    ...(project.extractedManualFindingDrafts.length > 0 ? ['manual-review-draft-review-gate'] : []),
    ...(exportQualityFlags.length > 0 ? ['manual-review-export-quality-flags'] : []),
  ]);

  return {
    case_id: generateLearningCaseId(),
    created_at: createdAt,
    trigger,
    review_mode: project.reviewMode,
    trust_level: 'user_entered_unverified',
    training_eligible: false,
    requires_human_review: true,
    registry_or_standard: registryLabel !== 'Unknown registry' ? registryLabel : undefined,
    document_type: manualDocumentTypeLabel(project),
    source_document_count: project.documents.length,
    finding_count: project.manualFindings.length,
    finding_type_counts: findingTypeCounts,
    closure_counts: closureCounts,
    fields_present: fieldsPresent,
    fields_missing: fieldsMissing,
    reviewer_correction_summary: {
      extracted_draft_count: project.extractedManualFindingDrafts.length,
      draft_findings_ready_count: project.extractedManualFindingDrafts.filter((draft) => draft.extractionStatus === 'draft').length,
      draft_findings_needing_review_count: project.extractedManualFindingDrafts.filter((draft) => draft.extractionStatus === 'needs-review').length,
      reviewer_note_count: fieldsPresent.reviewer_note,
    },
    export_quality_flags: exportQualityFlags,
    truth_rules_triggered: truthRulesTriggered,
    recommended_evals: recommendedEvals,
    source_retention_policy: RETENTION_POLICY,
    dedup_key: dedupKey,
  };
}
