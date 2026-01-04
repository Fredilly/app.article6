/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import { buildProofBundleV1 } from "@/lib/proof/bundle";
import { buildAuditZipBytes, readAuditZipBytes } from "@/lib/proof/auditZip";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import { importProofBundleFile } from "@/lib/proof/import";
import { loadPins } from "@/lib/proofMap/storage";
import { getAttachmentBytes } from "@/lib/proofMap/attachments";

describe("evidence attachment hashing", () => {
  test("sha256ArrayBuffer returns stable hash for known bytes", async () => {
    const bytes = new Uint8Array([97, 98, 99]).buffer;
    const sha = await sha256ArrayBuffer(bytes);
    expect(sha).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("audit zip exporter/importer", () => {
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
    const attachmentFiles = Object.keys(zip.files).filter((p) => p.startsWith("attachments/att-1__"));
    expect(attachmentFiles).toHaveLength(1);
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
});
