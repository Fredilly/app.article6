import type { AssistantAnswer } from "@/lib/assistant/generateAnswer";

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
};

export function buildAssistantBundle(input: {
  answer: AssistantAnswer;
  evidencePayloads: AssistantEvidencePayloads;
  provenance: AssistantBundle["provenance"];
}): AssistantBundle {
  return {
    answer: input.answer,
    evidence_items: input.answer.evidence,
    evidence_payloads: input.evidencePayloads,
    provenance: input.provenance,
  };
}

