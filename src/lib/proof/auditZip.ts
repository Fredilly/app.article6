import JSZip from "jszip";
import type { EvidenceAttachment, EvidencePin } from "@/lib/proofMap/types";
import type { ProofBundleV1 } from "@/lib/proof/bundle";
import { isProofBundleV1, verifyProofBundleIntegrity } from "@/lib/proof/bundle";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import { getAttachmentBytes, putAttachmentBytes } from "@/lib/proofMap/attachments";

function safeFilename(value: string): string {
  const trimmed = (value ?? "").trim() || "file";
  const withoutPath = trimmed.replace(/[\\/]+/g, "_");
  return withoutPath.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 160) || "file";
}

function collectAttachmentsFromPins(pins: EvidencePin[] | undefined): EvidenceAttachment[] {
  const out: EvidenceAttachment[] = [];
  for (const pin of pins ?? []) {
    for (const att of pin.attachments ?? []) out.push(att);
  }
  return out;
}

function bundleAttachments(bundle: ProofBundleV1): EvidenceAttachment[] {
  const list = (bundle as { evidence_attachments?: EvidenceAttachment[] }).evidence_attachments;
  if (Array.isArray(list) && list.length) return list;
  return collectAttachmentsFromPins(bundle.evidence_pins);
}

export async function buildAuditZipBytes(input: {
  bundle: ProofBundleV1;
  attachments: Array<{ id: string; filename: string; bytes: ArrayBuffer }>;
}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("bundle.json", JSON.stringify(input.bundle, null, 2));
  for (const att of input.attachments) {
    zip.file(`attachments/${att.id}__${safeFilename(att.filename)}`, att.bytes);
  }
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function exportAuditZipFromStorage(bundle: ProofBundleV1): Promise<Uint8Array> {
  const attachments = bundleAttachments(bundle);
  const payload: Array<{ id: string; filename: string; bytes: ArrayBuffer }> = [];
  for (const meta of attachments) {
    const bytes = await getAttachmentBytes(meta.id);
    if (!bytes) throw new Error(`Missing attachment bytes for ${meta.filename} (${meta.id}).`);
    payload.push({ id: meta.id, filename: meta.filename, bytes });
  }
  return await buildAuditZipBytes({ bundle, attachments: payload });
}

export type AuditZipReadResult =
  | { ok: true; bundle: ProofBundleV1; attachments: Array<{ meta: EvidenceAttachment; bytes: ArrayBuffer }> }
  | { ok: false; message: string };

export async function readAuditZipBytes(zipBytes: ArrayBuffer | Uint8Array): Promise<AuditZipReadResult> {
  try {
    const zip = await JSZip.loadAsync(zipBytes);
    const bundleFile = zip.file("bundle.json");
    if (!bundleFile) return { ok: false, message: "bundle.json missing from zip." };
    const bundleText = await bundleFile.async("text");
    const parsed = JSON.parse(bundleText) as unknown;
    if (!isProofBundleV1(parsed)) {
      return { ok: false, message: "Bundle schema mismatch (expected proof-bundle@1)." };
    }
    const check = await verifyProofBundleIntegrity(parsed);
    if (!check.ok) return { ok: false, message: "Bundle integrity check failed." };

    const attachmentsMeta = bundleAttachments(parsed);
    const integrityList = parsed.integrity && typeof parsed.integrity === "object"
      ? (parsed.integrity as { attachments?: Array<{ id: string; sha256: string }> }).attachments
      : undefined;
    if (integrityList && integrityList.length) {
      const integrityById = new Map(integrityList.map((row) => [row.id, row.sha256]));
      for (const meta of attachmentsMeta) {
        const expected = integrityById.get(meta.id);
        if (expected && expected !== meta.sha256) {
          return { ok: false, message: `Attachment integrity mismatch for ${meta.id}.` };
        }
      }
    }

    const allPaths = Object.keys(zip.files);
    const attachments: Array<{ meta: EvidenceAttachment; bytes: ArrayBuffer }> = [];
    for (const meta of attachmentsMeta) {
      const prefix = `attachments/${meta.id}__`;
      const match = allPaths.filter((p) => p.startsWith(prefix) && !zip.files[p]?.dir);
      if (match.length !== 1) {
        return { ok: false, message: `Attachment file missing from zip for ${meta.filename} (${meta.id}).` };
      }
      const bytes = await zip.file(match[0])!.async("arraybuffer");
      const actual = await sha256ArrayBuffer(bytes);
      if (actual !== meta.sha256) {
        return { ok: false, message: `Attachment hash mismatch for ${meta.filename} (${meta.id}).` };
      }
      attachments.push({ meta, bytes });
    }

    return { ok: true, bundle: parsed, attachments };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function writeAuditZipToStorage(input: {
  bundle: ProofBundleV1;
  attachments: Array<{ meta: EvidenceAttachment; bytes: ArrayBuffer }>;
}): Promise<void> {
  for (const { meta, bytes } of input.attachments) {
    await putAttachmentBytes(meta.id, bytes);
  }
}

