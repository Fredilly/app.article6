import type { AssistantAnswer } from "@/lib/assistant/generateAnswer";
import type { GeoVistaVerification } from "@/services/geovista/types";
import { buildArtifactsFromEvidenceIds } from "@/services/geovista/artifacts";

export type AssistantEvidencePayloads = {
  sections: unknown[];
  rules: unknown[];
};

export type AssistantBundle = {
  answer: AssistantAnswer;
  evidence_items: AssistantAnswer["evidence"];
  evidence_payloads: AssistantEvidencePayloads;
  provenance: {
    pack_tag?: string;
    pack_id?: string;
    generated_at?: string;
    repo_sha?: string;
    audit_hashes?: Record<string, string>;
  };
  geovista?: GeoVistaVerification;
};

export function buildAssistantBundle(input: {
  answer: AssistantAnswer;
  evidencePayloads: AssistantEvidencePayloads;
  provenance: AssistantBundle["provenance"];
  geovista?: GeoVistaVerification;
}): AssistantBundle {
  const citedIds = input.answer.evidence
    .filter((item) => item.type === "rule" || item.type === "section")
    .map((item) => item.id);
  const expectedArtifacts = buildArtifactsFromEvidenceIds(citedIds);

  const geovista =
    input.geovista && expectedArtifacts.length
      ? { ...input.geovista, artifacts: expectedArtifacts }
      : undefined;

  return {
    answer: input.answer,
    evidence_items: input.answer.evidence,
    evidence_payloads: input.evidencePayloads,
    provenance: input.provenance,
    geovista,
  };
}
