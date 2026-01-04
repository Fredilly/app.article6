import { isProofBundleV1, verifyProofBundleIntegrity } from "@/lib/proof/bundle";
import { saveAoi, saveEvidenceSnapshots, savePins, saveVerificationRuns } from "@/lib/proofMap/storage";
import { readAuditZipBytes, writeAuditZipToStorage } from "@/lib/proof/auditZip";

export type ProofBundleImportResult =
  | { ok: true }
  | { ok: false; code: "SCHEMA_INVALID" | "INTEGRITY_FAILED" | "SWITCH_REQUIRED"; message: string; target?: { code: string; version: string } };

function isZipFile(file: File): boolean {
  const name = (file.name ?? "").toLowerCase();
  if (name.endsWith(".zip")) return true;
  const type = (file.type ?? "").toLowerCase();
  return type === "application/zip" || type === "application/x-zip-compressed";
}

async function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  const anyFile = file as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof anyFile.arrayBuffer === "function") return await anyFile.arrayBuffer();
  return await new Response(file).arrayBuffer();
}

export async function importProofBundleText(
  bundleText: string,
  current: { code: string; version: string },
): Promise<ProofBundleImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bundleText) as unknown;
  } catch (error) {
    return { ok: false, code: "SCHEMA_INVALID", message: error instanceof Error ? error.message : String(error) };
  }

  if (!isProofBundleV1(parsed)) {
    return { ok: false, code: "SCHEMA_INVALID", message: "Bundle schema mismatch (expected proof-bundle@1)." };
  }

  const check = await verifyProofBundleIntegrity(parsed);
  if (!check.ok) {
    return { ok: false, code: "INTEGRITY_FAILED", message: "Bundle integrity check failed." };
  }

  const target = { code: parsed.method.code, version: parsed.method.version };
  if (target.code !== current.code || target.version !== current.version) {
    return {
      ok: false,
      code: "SWITCH_REQUIRED",
      message: `Bundle targets ${target.code} ${target.version}.`,
      target,
    };
  }

  saveAoi(target.code, target.version, parsed.aoi ?? null);
  savePins(target.code, target.version, parsed.evidence_pins ?? []);
  saveEvidenceSnapshots(target.code, target.version, parsed.evidence_items ?? []);
  return { ok: true };
}

export async function importProofBundleFile(
  file: File,
  current: { code: string; version: string },
): Promise<ProofBundleImportResult> {
  if (!isZipFile(file)) {
    const text = await file.text();
    return await importProofBundleText(text, current);
  }

  const bytes = await readFileBytes(file);
  const read = await readAuditZipBytes(bytes);
  if (!read.ok) {
    const code = read.message.includes("schema mismatch") || read.message.includes("bundle.json") ? "SCHEMA_INVALID" : "INTEGRITY_FAILED";
    return { ok: false, code, message: read.message };
  }

  const target = { code: read.bundle.method.code, version: read.bundle.method.version };
  if (target.code !== current.code || target.version !== current.version) {
    return {
      ok: false,
      code: "SWITCH_REQUIRED",
      message: `Bundle targets ${target.code} ${target.version}.`,
      target,
    };
  }

  saveAoi(target.code, target.version, read.bundle.aoi ?? null);
  savePins(target.code, target.version, read.bundle.evidence_pins ?? []);
  saveEvidenceSnapshots(target.code, target.version, read.bundle.evidence_items ?? []);
  saveVerificationRuns(target.code, target.version, read.runs ?? []);
  await writeAuditZipToStorage({ bundle: read.bundle, attachments: read.attachments });
  return { ok: true };
}
