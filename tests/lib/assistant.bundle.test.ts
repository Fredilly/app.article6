import { describe, expect, test } from "@jest/globals";
import { buildAssistantBundle } from "@/lib/assistant/bundle";
import type { AssistantAnswer } from "@/lib/assistant/generateAnswer";

describe("buildAssistantBundle", () => {
  test("includes payloads for cited ids", () => {
    const answer: AssistantAnswer = {
      question_id: "required_data",
      answer_md: "## Answer\nTest",
      evidence: [
        { type: "section", id: "S-10", title: "Data", excerpt: "Excerpt", quality: "low" },
        { type: "rule", id: "R-1", title: "Rule", excerpt: "Excerpt", quality: "low" },
      ],
      assumptions: [],
      next_actions: [],
      provenance: {},
    };

    const bundle = buildAssistantBundle({
      answer,
      evidencePayloads: {
        sections: [{ id: "S-10", text: "section payload" }],
        rules: [{ id: "R-1", text: "rule payload" }],
      },
      provenance: { pack_id: "abc", generated_at: "2026-01-01T00:00:00Z" },
    });

    expect(bundle.evidence_items).toHaveLength(2);
    expect(Array.isArray(bundle.evidence_payloads.sections)).toBe(true);
    expect(Array.isArray(bundle.evidence_payloads.rules)).toBe(true);
    expect((bundle.evidence_payloads.sections[0] as any).id).toBe("S-10");
    expect((bundle.evidence_payloads.rules[0] as any).id).toBe("R-1");
  });

  test("includes geovista snapshot when provided", () => {
    const answer: AssistantAnswer = {
      question_id: "purpose_claims",
      answer_md: "## Answer\nTest",
      evidence: [{ type: "section", id: "S-1", title: "Purpose", excerpt: "Excerpt", quality: "low" }],
      assumptions: [],
      next_actions: [],
      provenance: {},
    };

    const bundle = buildAssistantBundle({
      answer,
      evidencePayloads: { sections: [], rules: [] },
      provenance: {},
      geovista: {
        status: "verified",
        summary: "Verified via mock.",
        artifacts: [{ id: "artifact-1" }],
        generated_at: "2026-01-01T00:00:00Z",
        provenance: { source: "mock" },
      },
    });

    expect(bundle.geovista?.status).toBe("verified");
    expect(bundle.geovista?.artifacts[0]?.id).toBe("artifact-1");
  });
});
