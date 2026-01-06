import JSZip from "jszip";
import type { EvidenceAttachment, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofBundleV1 } from "@/lib/proof/bundle";
import { canonicalizeProofBundleForHash, isProofBundleV1, sha256Hex, verifyProofBundleIntegrity } from "@/lib/proof/bundle";
import { sha256ArrayBuffer, sha256Text } from "@/lib/proof/hash";
import { canonicalJson } from "@/lib/proof/fingerprints";
import { getAttachmentBytes, putAttachmentBytes } from "@/lib/proofMap/attachments";
import { loadVerificationRuns } from "@/lib/proofMap/storage";
import extractStacArtifacts from "@/lib/export/extractStacArtifacts";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import buildProvenanceTxt from "@/lib/export/buildProvenanceTxt";
import selectRunsForAoi from "@/lib/export/selectRunsForAoi";

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
  runs?: VerificationRun[];
  verificationSnapshot?: {
    provenanceText: string;
    stacItemsJson: unknown;
    stacEvidenceGeojson: GeoJSON.FeatureCollection;
  };
}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("bundle.json", JSON.stringify(input.bundle, null, 2));
  if (input.runs && input.runs.length) {
    zip.file("runs.json", canonicalJson(input.runs));
  }

  const emptyEvidence: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const provenanceText = input.verificationSnapshot?.provenanceText ?? buildProvenanceTxt({});
  zip.file("evidence/provenance.txt", provenanceText);
  zip.file("evidence/stac_items.json", canonicalJsonStringify(input.verificationSnapshot?.stacItemsJson ?? { items: [] }));
  zip.file(
    "evidence/stac_evidence.geojson",
    canonicalJsonStringify(input.verificationSnapshot?.stacEvidenceGeojson ?? emptyEvidence),
  );

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

  const methodCode = bundle.method.code;
  const version = bundle.method.version;
  const allRuns = loadVerificationRuns(methodCode, version);
  const currentAoiId = bundle.aoi?.id ?? null;
  const currentAoiFingerprint =
    bundle.aoi?.aoi_fingerprint ??
    (bundle.aoi?.geojson ? await sha256Hex(canonicalJson(bundle.aoi.geojson)) : null);

  const pinsForExport =
    currentAoiFingerprint && currentAoiId
      ? (bundle.evidence_pins ?? []).filter(
          (pin) => pin.aoi_fingerprint === currentAoiFingerprint || pin.aoi_id === currentAoiId,
        )
      : (bundle.evidence_pins ?? []);

  const runsForExport = selectRunsForAoi({
    runs: allRuns,
    aoiFingerprint: currentAoiFingerprint,
    aoiId: currentAoiId,
  });
  const runsText = runsForExport.length ? canonicalJson(runsForExport) : "";
  const runs_sha256 = runsText ? await sha256Text(runsText) : undefined;

  const scopedBundle: ProofBundleV1 = {
    ...bundle,
    aoi: bundle.aoi ? { ...bundle.aoi, aoi_fingerprint: currentAoiFingerprint ?? undefined } : bundle.aoi,
    evidence_pins: pinsForExport.length ? pinsForExport : undefined,
  };

  const stac = extractStacArtifacts({ runsForAoi: runsForExport });
  const provenanceText = buildProvenanceTxt({
    method_code: methodCode,
    method_version: version,
    aoi_id: currentAoiId ?? undefined,
    aoi_fingerprint: currentAoiFingerprint ?? undefined,
    stac_run_id: stac.stac_run_id,
    stac_status: stac.stac_status,
    stac_executed_at: stac.stac_executed_at,
    stac_item_count: stac.stac_item_count,
  });

  const bundleWithRunsIntegrity: ProofBundleV1 = runs_sha256
    ? { ...scopedBundle, integrity: { ...scopedBundle.integrity, runs_sha256 } }
    : scopedBundle;
  if (runs_sha256) {
    const canonical = canonicalizeProofBundleForHash(bundleWithRunsIntegrity);
    bundleWithRunsIntegrity.integrity.sha256 = await sha256Hex(canonical);
  }

  return await buildAuditZipBytes({
    bundle: bundleWithRunsIntegrity,
    attachments: payload,
    runs: runsForExport.length ? runsForExport : undefined,
    verificationSnapshot: {
      provenanceText,
      stacItemsJson: stac.stac_items_json,
      stacEvidenceGeojson: stac.stac_evidence_geojson,
    },
  });
}

export type AuditZipReadResult =
  | {
      ok: true;
      bundle: ProofBundleV1;
      attachments: Array<{ meta: EvidenceAttachment; bytes: ArrayBuffer }>;
      runs: VerificationRun[];
    }
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

    const runsFile = zip.file("runs.json");
    const integrityRunsSha =
      parsed.integrity && typeof parsed.integrity === "object"
        ? (parsed.integrity as { runs_sha256?: string }).runs_sha256
        : undefined;
    const runsText = runsFile ? await runsFile.async("text") : "";
    if (integrityRunsSha && !runsFile) {
      return { ok: false, message: "runs.json missing from zip." };
    }
    if (runsFile && integrityRunsSha) {
      const actualRunsSha = await sha256Text(runsText);
      if (actualRunsSha !== integrityRunsSha) return { ok: false, message: "Runs integrity check failed." };
    }
    const parsedRuns: unknown = runsText ? JSON.parse(runsText) : [];
    const runs = Array.isArray(parsedRuns) ? (parsedRuns as VerificationRun[]) : [];

    return { ok: true, bundle: parsed, attachments, runs };
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
