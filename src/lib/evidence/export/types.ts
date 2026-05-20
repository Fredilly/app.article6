import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { SourceDocument, DocumentFragment, ExtractedFact, CandidateLink } from '@/lib/evidence/extraction/types';
import type { ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type { DecisionRun } from '@/lib/evidence/decisions/types';
import type { Project, ProjectCoverage } from '@/lib/projects/types';

export type PremiumExportInput = {
  project: Project;
  coverage: ProjectCoverage;
  inventory: EvidenceInventoryItem[];
  sources: SourceDocument[];
  fragments: DocumentFragment[];
  facts: ExtractedFact[];
  candidateLinks: CandidateLink[];
  reconciliationRun?: ReconciliationRun;
  decisionRun?: DecisionRun;
  exportTime?: string;
  pipelineVersion?: string;
};

export type PremiumExportOutput = {
  pdf: Buffer;
  zip: Buffer;
};

export type PremiumExportMeta = {
  exportId: string;
  projectId: string;
  exportedAt: string;
  pipelineVersion: string;
  inputFingerprint: string;
  contentHash: string;
};

export type ManifestEntry = {
  path: string;
  contentSha256: string;
  sizeBytes: number;
};
