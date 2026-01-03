import { describe, expect, test } from "@jest/globals";
import { formatIso, pickProvenanceFields, shortSha } from "@/lib/trustFormat";

describe("shortSha", () => {
  test("returns first 12 for hex-ish sha", () => {
    expect(shortSha("3e3ade64f2e83b5b4ec81339b4e1dc744665cf13")).toBe("3e3ade64f2e8");
  });

  test("returns trimmed input for non-hex", () => {
    expect(shortSha("methodologies-pack-3ea9dc32bfaf")).toBe("methodologies-pack-3ea9dc32bfaf");
  });
});

describe("formatIso", () => {
  test("formats to deterministic ISO-like label", () => {
    expect(formatIso("2026-01-02T15:50:29.000Z")).toBe("2026-01-02 15:50:29Z");
  });

  test("returns original string if invalid date", () => {
    expect(formatIso("not-a-date")).toBe("not-a-date");
  });
});

describe("pickProvenanceFields", () => {
  test("picks provenance repo/sha/generated_at", () => {
    const picked = pickProvenanceFields({
      repo: "Fredilly/article6-methodologies",
      sha: "3e3ade64f2e83b5b4ec81339b4e1dc744665cf13",
      generated_at: "2026-01-02T15:50:29Z",
    });
    expect(picked.repo).toBe("Fredilly/article6-methodologies");
    expect(picked.sha).toBe("3e3ade64f2e83b5b4ec81339b4e1dc744665cf13");
    expect(picked.generatedAt).toBe("2026-01-02T15:50:29Z");
  });

  test("picks audit hashes when present", () => {
    const picked = pickProvenanceFields({
      audit_hashes: {
        rules_json_sha256: "rules",
        sections_json_sha256: "sections",
        source_pdf_sha256: "pdf",
      },
    });
    expect(picked.auditHashes?.rules).toBe("rules");
    expect(picked.auditHashes?.sections).toBe("sections");
    expect(picked.auditHashes?.sourcePdf).toBe("pdf");
  });
});

