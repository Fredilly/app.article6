export type ReconciliationItemStatus = "linked" | "unmatched" | "gap";

export type ReconciliationItem = {
  id: string;
  fragmentId?: string;
  factId?: string;
  ruleId?: string;
  ruleTitle?: string;
  sectionId?: string;
  status: ReconciliationItemStatus;
  matchType?: string;
  confidence?: number;
  isManualOverride: boolean;
  contentSha256: string;
};

export type CoverageGap = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  expectedEvidenceIds: string[];
  matchedEvidenceIds: string[];
};

export type ReconciliationRun = {
  runId: string;
  createdAt: string;
  projectId: string;
  items: ReconciliationItem[];
  gaps: CoverageGap[];
  itemFingerprint: string;
  gapFingerprint: string;
  reconciliationFingerprint: string;
};

export type ReconciliationInput = {
  fragments: Array<{
    fragmentId: string;
    documentId: string;
    text: string;
    contentSha256: string;
    label: string;
    pageStart?: number;
    pageEnd?: number;
    sheetName?: string;
    sheetIndex?: number;
  }>;
  facts: Array<{
    factId: string;
    fragmentId: string;
    factType: string;
    value: string;
    context: string;
    contentSha256: string;
  }>;
  candidateLinks: Array<{
    linkId: string;
    factId: string;
    ruleId: string;
    ruleTitle: string;
    sectionId: string;
    matchType: string;
    matchReason: string;
    confidence: number;
    contentSha256: string;
  }>;
  methodCode: string;
  methodVersion: string;
  projectId: string;
};
