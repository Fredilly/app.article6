import { describe, expect, test } from "@jest/globals";
import { buildProofBundleV1, canonicalizeProofBundleForHash, sha256Hex } from "@/lib/proof/bundle";

describe("proof bundle exporter", () => {
  test("outputs proof-bundle@1 schema with method metadata", async () => {
    const bundle = await buildProofBundleV1({
      program: "UNFCCC",
      sector: "Forestry",
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      generated_at: "2026-01-01T00:00:00Z",
      provenance: { repo: "Fredilly/article6-methodologies", sha: "abc123" },
      pack_digest: "pack-1",
      rules: [{ id: "R-1", title: "Rule 1", snippet: "Rule snippet" }],
      sections: [{ id: "S-1", title: "Section 1", textSnippet: "Section snippet" }],
      evidence_pins: [],
    });

    expect(bundle.bundle_version).toBe("proof-bundle@1");
    expect(typeof bundle.exported_at).toBe("string");
    expect(bundle.method).toMatchObject({
      program: "UNFCCC",
      sector: "Forestry",
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      generated_at: "2026-01-01T00:00:00Z",
    });
    expect(bundle.provenance).toMatchObject({
      repo: "Fredilly/article6-methodologies",
      commit: "abc123",
      pack_digest: "pack-1",
    });
    expect(typeof bundle.integrity.sha256).toBe("string");
    expect(bundle.integrity.sha256.length).toBeGreaterThan(10);
  });

  test("evidence snapshot contains all cited ids from pins", async () => {
    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [{ id: "R-1", title: "Rule 1", snippet: "Rule snippet" }],
      sections: [{ id: "S-1", title: "Section 1", textSnippet: "Section snippet" }],
      evidence_pins: [
        {
          id: "pin-1",
          kind: "note",
          title: "Q",
          cited_ids: ["S-1", "R-1"],
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    expect(bundle.evidence_items?.map((item) => `${item.kind}:${item.id}`).sort()).toEqual([
      "rule:R-1",
      "section:S-1",
    ]);
    const section = bundle.evidence_items?.find((i) => i.id === "S-1")!;
    expect(section.stable_ref).toContain("?section=S-1");
    const rule = bundle.evidence_items?.find((i) => i.id === "R-1")!;
    expect(rule.stable_ref).toContain("?rule=R-1");
  });

  test("integrity.sha256 changes when payload changes", async () => {
    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: { repo: "r", sha: "s" },
      rules: [],
      sections: [],
      evidence_pins: [],
    });

    const canonical = canonicalizeProofBundleForHash(bundle);
    const computed = await sha256Hex(canonical);
    expect(bundle.integrity.sha256).toBe(computed);

    const modified = { ...bundle, method: { ...bundle.method, source: "Changed" } };
    const canonical2 = canonicalizeProofBundleForHash(modified);
    const computed2 = await sha256Hex(canonical2);
    expect(computed2).not.toBe(bundle.integrity.sha256);
  });
});

