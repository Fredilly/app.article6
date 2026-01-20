import { describe, expect, test } from "@jest/globals";
import { buildAssistantBundle } from "@/lib/assistant/bundle";
import type { AssistantAnswer } from "@/lib/assistant/generateAnswer";

describe("buildAssistantBundle", () => {
  test("includes payloads for cited ids", () => {
    const answer: AssistantAnswer = {
      question_id: "important_rules",
      answer: "Test",
      evidence: [
        { type: "section", id: "S-10", title: "Data" },
        { type: "rule", id: "R-1", title: "Rule" },
      ],
      assumptions: [],
      next_actions: [{ id: "open_verify", label: "Open Verify" }],
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

  test("includes AOI and evidence pins when present", () => {
    const answer: AssistantAnswer = {
      question_id: "important_rules",
      answer: "Test",
      evidence: [{ type: "section", id: "S-1", title: "One" }],
      assumptions: [],
      next_actions: [{ id: "open_verify", label: "Open Verify" }],
      provenance: {},
    };

    const bundle = buildAssistantBundle({
      answer,
      evidencePayloads: { sections: [], rules: [] },
      provenance: {},
      aoi: {
        id: "aoi-1",
        name: "Test AOI",
        geojson: {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]] },
          properties: {},
        },
        bbox: [0, 0, 1, 1],
        area_km2: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
      evidencePins: [
        {
          id: "pin-1",
          kind: "note",
          title: "Q",
          aoi_id: "aoi-1",
          cited_ids: ["S-1"],
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(bundle.aoi?.id).toBe("aoi-1");
    expect(bundle.evidence_pins?.[0]?.id).toBe("pin-1");
  });

  test("includes evidence pins even when citations drift", () => {
    const answer: AssistantAnswer = {
      question_id: "important_rules",
      answer: "Test",
      evidence: [{ type: "section", id: "S-1", title: "One" }],
      assumptions: [],
      next_actions: [{ id: "open_verify", label: "Open Verify" }],
      provenance: {},
    };

    const bundle = buildAssistantBundle({
      answer,
      evidencePayloads: { sections: [], rules: [] },
      provenance: {},
      evidencePins: [
        {
          id: "pin-1",
          kind: "note",
          title: "Q",
          cited_ids: ["S-999"],
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(bundle.evidence_pins?.[0]?.cited_ids).toEqual(["S-999"]);
  });
});
