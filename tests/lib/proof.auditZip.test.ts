/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import { buildProofBundleV1 } from "@/lib/proof/bundle";
import { buildAuditZipBytes, exportAuditZipFromStorage, readAuditZipBytes } from "@/lib/proof/auditZip";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import { importProofBundleFile } from "@/lib/proof/import";
import { loadPins, loadVerificationRuns, saveVerificationRuns } from "@/lib/proofMap/storage";
import { getAttachmentBytes } from "@/lib/proofMap/attachments";
import { buildVerificationRunInputFromPins } from "@/lib/proofMap/verificationRuns";

describe("evidence attachment hashing", () => {
  test("sha256ArrayBuffer returns stable hash for known bytes", async () => {
    const bytes = new Uint8Array([97, 98, 99]).buffer;
    const sha = await sha256ArrayBuffer(bytes);
    expect(sha).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("audit zip exporter/importer", () => {
  test("run builder unions cited_ids + attachment_sha256", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const sha = await sha256ArrayBuffer(bytes);
    const input = buildVerificationRunInputFromPins([
      {
        id: "pin-1",
        kind: "doc",
        title: "Pin",
        cited_ids: ["S-1", "S-1", "R-1"],
        created_at: "2026-01-01T00:00:00Z",
        attachments: [
          {
            id: "att-1",
            pin_id: "pin-1",
            filename: "evidence.pdf",
            mime: "application/pdf",
            size: 3,
            sha256: sha,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      {
        id: "pin-2",
        kind: "doc",
        title: "Pin2",
        cited_ids: ["R-1"],
        created_at: "2026-01-01T00:00:00Z",
        attachments: [],
      },
    ]);

    expect(input.cited_ids.sort()).toEqual(["R-1", "S-1"]);
    expect(input.attachment_sha256).toEqual([sha]);
  });

  test("export ZIP includes bundle.json + N attachments", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const sha = await sha256ArrayBuffer(bytes);

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [
        {
          id: "pin-1",
          kind: "doc",
          title: "Pin",
          cited_ids: [],
          created_at: "2026-01-01T00:00:00Z",
          attachments: [
            {
              id: "att-1",
              pin_id: "pin-1",
              filename: "evidence.pdf",
              mime: "application/pdf",
              size: 3,
              sha256: sha,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ],
    });

    const zipBytes = await buildAuditZipBytes({
      bundle,
      attachments: [{ id: "att-1", filename: "evidence.pdf", bytes }],
    });

    const zip = await JSZip.loadAsync(zipBytes);
    expect(zip.file("bundle.json")).toBeTruthy();
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("evidence/rule_evidence_map.json")).toBeTruthy();
    expect(zip.file("evidence/review_log.json")).toBeTruthy();
    expect(zip.file("evidence/provenance.txt")).toBeTruthy();
    expect(zip.file("evidence/stac_items.json")).toBeTruthy();
    expect(zip.file("evidence/stac_evidence.geojson")).toBeTruthy();
    const attachmentFiles = Object.keys(zip.files).filter((p) => p.startsWith("attachments/att-1__"));
    expect(attachmentFiles).toHaveLength(1);
  });

  test("export ZIP writes integrity fields and validates manifest", async () => {
    const bytes = new Uint8Array([4, 5, 6]).buffer;
    const sha = await sha256ArrayBuffer(bytes);

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [
        {
          id: "pin-2",
          kind: "doc",
          title: "Pin",
          cited_ids: [],
          created_at: "2026-01-01T00:00:00Z",
          attachments: [
            {
              id: "att-2",
              pin_id: "pin-2",
              filename: "evidence.pdf",
              mime: "application/pdf",
              size: 3,
              sha256: sha,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ],
    });

    const zipBytes = await buildAuditZipBytes({
      bundle,
      attachments: [{ id: "att-2", filename: "evidence.pdf", bytes }],
    });

    const zip = await JSZip.loadAsync(zipBytes);
    const bundleText = await zip.file("bundle.json")!.async("text");
    const parsed = JSON.parse(bundleText) as { integrity?: Record<string, string> };
    expect(parsed.integrity?.bundle_sha256).toBeTruthy();
    expect(parsed.integrity?.zip_sha256).toBeTruthy();
    expect(parsed.integrity?.manifest_sha256).toBeTruthy();

    const read = await readAuditZipBytes(zipBytes);
    expect(read.ok).toBe(true);
  });

  test("rule evidence map is stable for fixed input", async () => {
    const { buildRuleEvidenceMap } = await import("@/lib/proof/auditZip");
    const mapA = buildRuleEvidenceMap({
      generatedAt: "2026-01-01T00:00:00Z",
      methodCode: "AR-ACM0003",
      version: "v02-0",
      aoiId: "aoi-1",
      aoiFingerprint: "fp-1",
      rules: [
        { id: "R-1", title: "Monitoring", snippet: "monitoring data" },
        { id: "R-2", title: "Other", snippet: "..." },
      ],
      sections: [
        { id: "S-1", title: "Monitoring section", textSnippet: "data requirements" },
        { id: "S-2", title: "Other section", textSnippet: "..." },
      ],
      stacItemsJson: { items: [{ id: "stac-1" }, { id: "stac-2" }] },
    });
    const mapB = buildRuleEvidenceMap({
      generatedAt: "2026-01-01T00:00:00Z",
      methodCode: "AR-ACM0003",
      version: "v02-0",
      aoiId: "aoi-1",
      aoiFingerprint: "fp-1",
      rules: [
        { id: "R-1", title: "Monitoring", snippet: "monitoring data" },
        { id: "R-2", title: "Other", snippet: "..." },
      ],
      sections: [
        { id: "S-1", title: "Monitoring section", textSnippet: "data requirements" },
        { id: "S-2", title: "Other section", textSnippet: "..." },
      ],
      stacItemsJson: { items: [{ id: "stac-1" }, { id: "stac-2" }] },
    });

    expect(JSON.stringify(mapA)).toBe(JSON.stringify(mapB));
  });

  test("review log includes entry when note provided", async () => {
    const { buildReviewLog } = await import("@/lib/proof/auditZip");
    const log = await buildReviewLog({
      createdAt: "2026-01-01T00:00:00Z",
      methodCode: "AR-ACM0003",
      version: "v02-0",
      aoiId: "aoi-1",
      aoiFingerprint: "fp-1",
      entry: { actor: "Reviewer", action: "note", note: "Check inputs." },
    });

    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]?.actor).toBe("Reviewer");
  });

  test("export ZIP includes runs.json when runs exist", async () => {
    window.localStorage.clear();
    saveVerificationRuns("AR-ACM0003", "v02-0", [
      {
        id: "run-1",
        method: { code: "AR-ACM0003", version: "v02-0" },
        aoi_fingerprint: "aoi-fp",
        input_fingerprint: "input-fp",
        cited_ids: ["S-1"],
        cited_ids_count: 1,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        summary: "Verified",
        result_json: { ok: true },
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [],
    });

    const zipBytes = await exportAuditZipFromStorage(bundle);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(zip.file("runs.json")).toBeTruthy();
  });

  test("import ZIP rejects when an attachment hash mismatches", async () => {
    const expectedBytes = new Uint8Array([9, 9, 9]).buffer;
    const expectedSha = await sha256ArrayBuffer(expectedBytes);
    const wrongBytes = new Uint8Array([9, 9, 8]).buffer;

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [
        {
          id: "pin-1",
          kind: "doc",
          title: "Pin",
          cited_ids: [],
          created_at: "2026-01-01T00:00:00Z",
          attachments: [
            {
              id: "att-1",
              pin_id: "pin-1",
              filename: "photo.png",
              mime: "image/png",
              size: 3,
              sha256: expectedSha,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ],
    });

    const zipBytes = await buildAuditZipBytes({
      bundle,
      attachments: [{ id: "att-1", filename: "photo.png", bytes: wrongBytes }],
    });

    const read = await readAuditZipBytes(zipBytes);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.message).toContain("Attachment hash mismatch");
  });

  test("import ZIP writes bytes to IndexedDB + metadata to localStorage", async () => {
    window.localStorage.clear();

    const bytes = new Uint8Array([7, 7, 7, 7]).buffer;
    const sha = await sha256ArrayBuffer(bytes);

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [
        {
          id: "pin-1",
          kind: "doc",
          title: "Pin",
          cited_ids: [],
          created_at: "2026-01-01T00:00:00Z",
          attachments: [
            {
              id: "att-zip-1",
              pin_id: "pin-1",
              filename: "evidence.pdf",
              mime: "application/pdf",
              size: 4,
              sha256: sha,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      ],
    });

    const zipBytes = await buildAuditZipBytes({
      bundle,
      attachments: [{ id: "att-zip-1", filename: "evidence.pdf", bytes }],
    });

    const file = new File([zipBytes], "audit.zip", { type: "application/zip" });
    const res = await importProofBundleFile(file, { code: "AR-ACM0003", version: "v02-0" });
    expect(res.ok).toBe(true);

    const pins = loadPins("AR-ACM0003", "v02-0");
    expect(pins).toHaveLength(1);
    expect(pins[0]?.attachments?.[0]?.id).toBe("att-zip-1");

    const stored = await getAttachmentBytes("att-zip-1");
    expect(stored).not.toBeNull();
    expect(Array.from(new Uint8Array(stored!))).toEqual(Array.from(new Uint8Array(bytes)));
  });

  test("import ZIP restores verification runs into localStorage", async () => {
    window.localStorage.clear();

    saveVerificationRuns("AR-ACM0003", "v02-0", [
      {
        id: "run-restore-1",
        method: { code: "AR-ACM0003", version: "v02-0" },
        aoi_fingerprint: "aoi-fp",
        input_fingerprint: "input-fp",
        cited_ids: ["S-1"],
        cited_ids_count: 1,
        attachment_sha256: ["sha"],
        attachment_count: 1,
        provider: "stac",
        status: "warn",
        summary: "Needs review",
        result_json: { status: "needs_review" },
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [],
    });

    const zipBytes = await exportAuditZipFromStorage(bundle);

    const file = new File([zipBytes], "audit.zip", { type: "application/zip" });
    const res = await importProofBundleFile(file, { code: "AR-ACM0003", version: "v02-0" });
    expect(res.ok).toBe(true);

    const runs = loadVerificationRuns("AR-ACM0003", "v02-0");
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe("run-restore-1");
  });
});
