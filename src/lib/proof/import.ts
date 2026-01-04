import { isProofBundleV1, verifyProofBundleIntegrity } from "@/lib/proof/bundle";
import { saveAoi, saveEvidenceSnapshots, savePins } from "@/lib/proofMap/storage";

export type ProofBundleImportResult =
  | { ok: true }
  | { ok: false; code: "SCHEMA_INVALID" | "INTEGRITY_FAILED" | "SWITCH_REQUIRED"; message: string; target?: { code: string; version: string } };

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
