import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  acceptExtractedManualFindingDraft,
  addExtractedManualFindingDrafts,
  createProject,
  getProject,
} from '@/lib/projects/storage';

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function installStorage() {
  const state = new Map<string, string>();
  const localStorage: LocalStorageMock = {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => {
      state.set(key, value);
    },
    removeItem: (key) => {
      state.delete(key);
    },
    clear: () => {
      state.clear();
    },
  };

  Object.defineProperty(global, 'window', {
    value: { localStorage },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(global, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  });

  return localStorage;
}

describe('project storage manual finding acceptance', () => {
  beforeEach(() => {
    const localStorage = installStorage();
    localStorage.clear();
  });

  it('preserves corrected FAR draft values when accepting into Manual Findings', () => {
    const project = createProject({
      name: 'Manual Review',
      reviewMode: 'manual',
      registry: 'Unknown',
    });

    addExtractedManualFindingDrafts(project.id, [
      {
        findingId: 'FAR05',
        findingType: 'FAR',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '50',
        requirement: '3.2.21(6)',
        evidenceExcerpt: 'FAR No. 05 Requirement:\n3.2.21(6)\nDescription of the FAR\nAssess if managed species are exhibiting invasive behavior.\nFAR open',
        closureStatus: 'open',
        extractionStatus: 'draft',
        extractionMessage: 'draft',
      },
    ]);

    const draftId = getProject(project.id)?.extractedManualFindingDrafts[0]?.id;
    expect(draftId).toBeDefined();

    acceptExtractedManualFindingDraft(project.id, draftId!);
    const accepted = getProject(project.id)?.manualFindings.find((finding) => finding.findingId === 'FAR05');

    expect(accepted).toEqual(expect.objectContaining({
      findingId: 'FAR05',
      findingType: 'FAR',
      sourcePageRange: '50',
      requirement: '3.2.21(6)',
      closureStatus: 'open',
    }));
  });

  it('falls back to an explicit FAR Open line in the evidence excerpt when draft closure status is missing', () => {
    const project = createProject({
      name: 'Manual Review',
      reviewMode: 'manual',
      registry: 'Unknown',
    });

    addExtractedManualFindingDrafts(project.id, [
      {
        findingId: 'FAR05',
        findingType: 'FAR',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '50',
        requirement: '3.2.21(6)',
        evidenceExcerpt: 'FAR No. 05 Requirement:\n3.2.21(6)\nDescription of the FAR\nAssess if managed species are exhibiting invasive behavior.\nFAR Open',
        extractionStatus: 'draft',
        extractionMessage: 'draft',
      },
    ]);

    const draftId = getProject(project.id)?.extractedManualFindingDrafts[0]?.id;
    expect(draftId).toBeDefined();

    acceptExtractedManualFindingDraft(project.id, draftId!);
    const accepted = getProject(project.id)?.manualFindings.find((finding) => finding.findingId === 'FAR05');

    expect(accepted?.closureStatus).toBe('open');
    expect(accepted?.sourcePageRange).toBe('50');
  });
});
