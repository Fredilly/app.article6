import type { AssistantAnswer } from "@/lib/assistant/generateAnswer";
import type { GeoVistaVerification } from "@/services/geovista/types";
import { buildArtifactsFromEvidenceIds } from "@/services/geovista/artifacts";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";

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
  aoi?: AOI | null;
  evidence_pins?: EvidencePin[];
};

export function buildAssistantBundle(input: {
  answer: AssistantAnswer;
  evidencePayloads: AssistantEvidencePayloads;
  provenance: AssistantBundle["provenance"];
  geovista?: GeoVistaVerification;
  aoi?: AOI | null;
  evidencePins?: EvidencePin[];
}): AssistantBundle {
  const citedIds = input.answer.evidence
    .filter((item) => item.type === "rule" || item.type === "section")
    .map((item) => item.id);
  const expectedArtifacts = buildArtifactsFromEvidenceIds(citedIds);

  const geovista =
    input.geovista && expectedArtifacts.length
      ? (() => {
          const byId = new Map<string, GeoVistaVerification["artifacts"][number]>();
          for (const artifact of input.geovista.artifacts ?? []) {
            if (!artifact?.id) continue;
            byId.set(artifact.id, artifact);
          }

          const artifacts = expectedArtifacts.map((expected) => {
            const found = byId.get(expected.id);
            if (!found) return expected;
            return { ...found, ...expected, id: expected.id, kind: expected.kind, ref_id: expected.ref_id };
          });

          return { ...input.geovista, artifacts };
        })()
      : undefined;

  const evidencePins = input.evidencePins && input.evidencePins.length ? input.evidencePins : undefined;

  return {
    answer: input.answer,
    evidence_items: input.answer.evidence,
    evidence_payloads: input.evidencePayloads,
    provenance: input.provenance,
    geovista,
    aoi: input.aoi ?? undefined,
    evidence_pins: evidencePins,
  };
}
