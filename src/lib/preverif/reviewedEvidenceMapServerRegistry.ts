import "server-only";

import reviewed from "../../../tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json";
import draft from "../../../tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.draft.json";
import metadata from "../../../tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/metadata.json";
import { adaptReviewedEvidenceMap } from "./reviewedEvidenceMapAdapter";
import {
  matchesReviewedEvidenceMapIdentity,
  type ReviewedEvidenceMapIdentity,
} from "./reviewedEvidenceMapRegistry";
import type { ReviewedEvidenceMapSnapshot } from "./reviewedEvidenceMapTypes";

const marcondes = adaptReviewedEvidenceMap({ reviewed, draft, metadata });
if (!marcondes)
  throw new Error(
    "The Marcondes reviewed Evidence Map artifact is incomplete or invalid.",
  );

const reviewedCases: readonly ReviewedEvidenceMapSnapshot[] = [marcondes];

export function loadReviewedEvidenceMapCandidates(): readonly ReviewedEvidenceMapSnapshot[] {
  return reviewedCases;
}

export function loadReviewedEvidenceMapCandidate(
  identity: ReviewedEvidenceMapIdentity,
): ReviewedEvidenceMapSnapshot | null {
  return (
    reviewedCases.find((entry) =>
      matchesReviewedEvidenceMapIdentity(identity, entry),
    ) ?? null
  );
}
