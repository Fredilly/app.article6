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

type AuditZipEntry = { path: string; bytes: Uint8Array };
type RuleSummary = { id: string; title?: string; snippet?: string; tags?: string[]; text?: string };
type SectionSummary = { id: string; title?: string; anchor?: string; textSnippet?: string; text?: string };

export type RuleEvidenceMapItem = {
  evidence_id: string;
  evidence_type: "stac" | "upload" | "note" | "other";
  source_ref: string;
  rule_ids: string[];
  section_anchors: string[];
  justification: string;
};

export type RuleEvidenceMap = {
  schema_version: "v1";
  generated_at: string;
  method: { code: string; version: string };
  aoi?: { id?: string; fingerprint?: string } | null;
  items: RuleEvidenceMapItem[];
  unmapped_reason?: string;
};

export type ReviewLogEntry = {
  id: string;
  ts: string;
  actor: string;
  action: "note" | "approve" | "reject" | "needs_more_evidence";
  note: string;
  refs: {
    evidence_ids?: string[];
    rule_ids?: string[];
    section_anchors?: string[];
  };
};

export type ReviewLog = {
  schema_version: "v1";
  created_at: string;
  method: { code: string; version: string };
  aoi?: { id?: string; fingerprint?: string } | null;
  entries: ReviewLogEntry[];
};

const ZIP_ENTRY_DATE = new Date("1980-01-01T00:00:00.000Z");

function safeFilename(value: string): string {
  const trimmed = (value ?? "").trim() || "file";
  const withoutPath = trimmed.replace(/[\\/]+/g, "_");
  return withoutPath.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 160) || "file";
}

function buildTrailJsonl(ts: string): Uint8Array {
  const entry = { ts, actor: "system", action: "trail.init", meta: { schema: "v1" } };
  return encodeText(`${JSON.stringify(entry)}\n`);
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

function cloneBundleWithIntegrity(bundle: ProofBundleV1): ProofBundleV1 {
  const integrity = bundle.integrity && typeof bundle.integrity === "object" ? { ...bundle.integrity } : {};
  return { ...bundle, integrity };
}

function bundleJsonBytes(bundle: ProofBundleV1): Uint8Array {
  const text = JSON.stringify(bundle, null, 2);
  return encodeText(text);
}

function encodeText(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  return new Uint8Array(Buffer.from(text, "utf8"));
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  return sha256ArrayBuffer(copy.buffer);
}

async function buildZipBytes(entries: AuditZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    zip.file(entry.path, entry.bytes, { date: ZIP_ENTRY_DATE });
  }
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function bundleForManifest(bundle: ProofBundleV1): ProofBundleV1 {
  return {
    ...bundle,
    integrity: {
      ...bundle.integrity,
      manifest_sha256: "",
    },
  };
}

async function buildManifestEntries(entries: AuditZipEntry[], bundleEntryHashBytes?: Uint8Array) {
  const manifestEntries = [];
  for (const entry of entries) {
    const bytes = entry.path === "bundle.json" && bundleEntryHashBytes ? bundleEntryHashBytes : entry.bytes;
    const sha256 = await hashBytes(bytes);
    manifestEntries.push({ path: entry.path, sha256, bytes: bytes.byteLength });
  }
  return manifestEntries.sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeText(value?: string): string {
  return (value ?? "").toString().toLowerCase();
}

function scoreByKeywords(text: string, keywords: string[]): number {
  return keywords.reduce((score, kw) => (text.includes(kw) ? score + 1 : score), 0);
}

function selectRules(rules: RuleSummary[], keywords: string[], limit: number): RuleSummary[] {
  const scored = rules
    .map((rule) => ({
      rule,
      score: scoreByKeywords(normalizeText([rule.id, rule.title, rule.snippet, rule.text, ...(rule.tags ?? [])].join(" ")), keywords),
    }))
    .sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id));

  const matches = scored.filter((row) => row.score > 0).map((row) => row.rule);
  const fallback = rules.slice(0, limit);
  return (matches.length ? matches : fallback).slice(0, limit);
}

function selectSections(sections: SectionSummary[], keywords: string[], limit: number): SectionSummary[] {
  const scored = sections
    .map((section) => ({
      section,
      score: scoreByKeywords(normalizeText([section.id, section.anchor, section.title, section.textSnippet, section.text].join(" ")), keywords),
    }))
    .sort((a, b) => b.score - a.score || a.section.id.localeCompare(b.section.id));

  const matches = scored.filter((row) => row.score > 0).map((row) => row.section);
  const fallback = sections.slice(0, limit);
  return (matches.length ? matches : fallback).slice(0, limit);
}

function extractStacItemIds(stacItemsJson: unknown): string[] {
  if (!stacItemsJson || typeof stacItemsJson !== "object") return [];
  const record = stacItemsJson as { items?: unknown };
  if (!Array.isArray(record.items)) return [];
  return record.items
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const id = (item as { id?: unknown }).id;
        if (typeof id === "string" && id.trim()) return id.trim();
      }
      return `item-${idx + 1}`;
    })
    .filter(Boolean);
}

export function buildRuleEvidenceMap(input: {
  generatedAt: string;
  methodCode: string;
  version: string;
  aoiId?: string | null;
  aoiFingerprint?: string | null;
  rules?: RuleSummary[];
  sections?: SectionSummary[];
  stacItemsJson?: unknown;
}): RuleEvidenceMap {
  const items = extractStacItemIds(input.stacItemsJson ?? { items: [] });
  const rules = input.rules ?? [];
  const sections = input.sections ?? [];
  const hasRules = rules.length > 0;
  const hasSections = sections.length > 0;

  if (!items.length) {
    return {
      schema_version: "v1",
      generated_at: input.generatedAt,
      method: { code: input.methodCode, version: input.version },
      aoi: { id: input.aoiId ?? undefined, fingerprint: input.aoiFingerprint ?? undefined },
      items: [],
      unmapped_reason: "No STAC evidence items to map.",
    };
  }

  if (!hasRules || !hasSections) {
    return {
      schema_version: "v1",
      generated_at: input.generatedAt,
      method: { code: input.methodCode, version: input.version },
      aoi: { id: input.aoiId ?? undefined, fingerprint: input.aoiFingerprint ?? undefined },
      items: [],
      unmapped_reason: "Rules/sections unavailable for mapping.",
    };
  }

  const keywords = ["monitor", "data", "remote", "qa", "qc", "sampling", "baseline"];
  const candidateRules = selectRules(rules, keywords, 3);
  const candidateSections = selectSections(sections, ["monitor", "data", "report", "qa", "qc"], 3);
  const ruleIds = candidateRules.map((rule) => rule.id);
  const sectionAnchors = candidateSections.map((section) => section.id);

  const mapItems: RuleEvidenceMapItem[] = items.map((id) => ({
    evidence_id: `stac:${id}`,
    evidence_type: "stac",
    source_ref: `evidence/stac_items.json#${id}`,
    rule_ids: ruleIds,
    section_anchors: sectionAnchors,
    justification: "Monitoring evidence mapped via keyword heuristics to relevant rules and sections.",
  }));

  return {
    schema_version: "v1",
    generated_at: input.generatedAt,
    method: { code: input.methodCode, version: input.version },
    aoi: { id: input.aoiId ?? undefined, fingerprint: input.aoiFingerprint ?? undefined },
    items: mapItems.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id)),
  };
}

export async function buildReviewLog(input: {
  createdAt: string;
  methodCode: string;
  version: string;
  aoiId?: string | null;
  aoiFingerprint?: string | null;
  entry?: { actor?: string; action?: ReviewLogEntry["action"]; note?: string };
}): Promise<ReviewLog> {
  const actor = (input.entry?.actor ?? "").trim() || "unknown";
  const note = (input.entry?.note ?? "").trim();
  const action = input.entry?.action ?? "note";
  const entries: ReviewLogEntry[] = [];

  if (note || actor !== "unknown" || action !== "note") {
    const entry = {
      ts: input.createdAt,
      actor,
      action,
      note: note || "(no note provided)",
      refs: {},
    };
    const id = await hashBytes(encodeText(JSON.stringify(entry)));
    entries.push({ id, ...entry });
  }

  return {
    schema_version: "v1",
    created_at: input.createdAt,
    method: { code: input.methodCode, version: input.version },
    aoi: { id: input.aoiId ?? undefined, fingerprint: input.aoiFingerprint ?? undefined },
    entries,
  };
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
  ruleEvidenceMap?: RuleEvidenceMap;
  reviewLog?: ReviewLog;
}): Promise<Uint8Array> {
  const bundleForZip = cloneBundleWithIntegrity(input.bundle);
  const canonical = canonicalizeProofBundleForHash(bundleForZip);
  const bundleSha = await sha256Hex(canonical);
  bundleForZip.integrity.bundle_sha256 = bundleSha;
  bundleForZip.integrity.sha256 = bundleSha;
  bundleForZip.integrity.sha256_meaning = "bundle_sha256";

  const entries: AuditZipEntry[] = [];
  const payloadEntries: AuditZipEntry[] = [];

  if (input.runs && input.runs.length) {
    const runsBytes = encodeText(canonicalJson(input.runs));
    payloadEntries.push({ path: "runs.json", bytes: runsBytes });
  }

  const emptyEvidence: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const provenanceText = input.verificationSnapshot?.provenanceText ?? buildProvenanceTxt({});
  payloadEntries.push({
    path: "evidence/provenance.txt",
    bytes: encodeText(provenanceText),
  });
  payloadEntries.push({
    path: "evidence/stac_items.json",
    bytes: encodeText(canonicalJsonStringify(input.verificationSnapshot?.stacItemsJson ?? { items: [] })),
  });
  payloadEntries.push({
    path: "evidence/stac_evidence.geojson",
    bytes: encodeText(canonicalJsonStringify(input.verificationSnapshot?.stacEvidenceGeojson ?? emptyEvidence)),
  });
  payloadEntries.push({
    path: "trail.jsonl",
    bytes: buildTrailJsonl(input.bundle.exported_at),
  });

  const ruleEvidenceMap =
    input.ruleEvidenceMap ??
    buildRuleEvidenceMap({
      generatedAt: input.bundle.exported_at,
      methodCode: input.bundle.method.code,
      version: input.bundle.method.version,
      aoiId: input.bundle.aoi?.id ?? null,
      aoiFingerprint: input.bundle.aoi?.aoi_fingerprint ?? null,
      rules: [],
      sections: [],
      stacItemsJson: input.verificationSnapshot?.stacItemsJson ?? { items: [] },
    });
  payloadEntries.push({
    path: "evidence/rule_evidence_map.json",
    bytes: encodeText(canonicalJsonStringify(ruleEvidenceMap)),
  });

  const reviewLog =
    input.reviewLog ??
    (await buildReviewLog({
      createdAt: input.bundle.exported_at,
      methodCode: input.bundle.method.code,
      version: input.bundle.method.version,
      aoiId: input.bundle.aoi?.id ?? null,
      aoiFingerprint: input.bundle.aoi?.aoi_fingerprint ?? null,
    }));
  payloadEntries.push({
    path: "evidence/review_log.json",
    bytes: encodeText(canonicalJsonStringify(reviewLog)),
  });

  for (const att of input.attachments) {
    payloadEntries.push({
      path: `attachments/${att.id}__${safeFilename(att.filename)}`,
      bytes: new Uint8Array(att.bytes),
    });
  }

  // zip_sha256 is computed over the payload zip (excludes bundle.json + manifest.json).
  const payloadZipBytes = await buildZipBytes(payloadEntries);
  bundleForZip.integrity.zip_sha256 = await hashBytes(payloadZipBytes);

  // Avoid hash recursion: manifest hashes bundle.json with manifest_sha256 cleared.
  const bundleJsonForManifest = bundleJsonBytes(bundleForManifest(bundleForZip));
  const manifestEntries = await buildManifestEntries(
    [{ path: "bundle.json", bytes: bundleJsonForManifest }, ...payloadEntries],
    bundleJsonForManifest,
  );

  const manifest = {
    kind: "article6.proof_audit_pack",
    version: 1,
    files: manifestEntries,
    hashing: {
      bundle_json: "bundle.json hashed with integrity.manifest_sha256 cleared",
      zip_sha256: "hash of payload zip excluding bundle.json and manifest.json",
    },
  };

  const manifestBytes = encodeText(canonicalJsonStringify(manifest));
  bundleForZip.integrity.manifest_sha256 = await hashBytes(manifestBytes);

  const bundleJsonForZip = bundleJsonBytes(bundleForZip);
  entries.push({ path: "bundle.json", bytes: bundleJsonForZip });
  entries.push(...payloadEntries);
  entries.push({ path: "manifest.json", bytes: manifestBytes });

  return await buildZipBytes(entries);
}

export async function exportAuditZipFromStorage(
  bundle: ProofBundleV1,
  options?: {
    rules?: RuleSummary[];
    sections?: SectionSummary[];
    reviewEntry?: { actor?: string; action?: ReviewLogEntry["action"]; note?: string };
  },
): Promise<Uint8Array> {
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

  const ruleEvidenceMap = buildRuleEvidenceMap({
    generatedAt: bundle.exported_at,
    methodCode,
    version,
    aoiId: currentAoiId,
    aoiFingerprint: currentAoiFingerprint,
    rules: options?.rules ?? [],
    sections: options?.sections ?? [],
    stacItemsJson: stac.stac_items_json,
  });

  const reviewLog = await buildReviewLog({
    createdAt: bundle.exported_at,
    methodCode,
    version,
    aoiId: currentAoiId,
    aoiFingerprint: currentAoiFingerprint,
    entry: options?.reviewEntry,
  });

  return await buildAuditZipBytes({
    bundle: bundleWithRunsIntegrity,
    attachments: payload,
    runs: runsForExport.length ? runsForExport : undefined,
    verificationSnapshot: {
      provenanceText,
      stacItemsJson: stac.stac_items_json,
      stacEvidenceGeojson: stac.stac_evidence_geojson,
    },
    ruleEvidenceMap,
    reviewLog,
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
    const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p]?.dir);
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
    const manifestFile = zip.file("manifest.json");
    const integrityRecord = parsed.integrity && typeof parsed.integrity === "object"
      ? (parsed.integrity as Record<string, unknown>)
      : {};

    if (integrityRecord.manifest_sha256) {
      if (!manifestFile) return { ok: false, message: "manifest.json missing from zip." };
      const manifestRaw = await manifestFile.async("text");
      const manifestSha = await sha256Text(manifestRaw);
      if (manifestSha !== integrityRecord.manifest_sha256) {
        return { ok: false, message: "Manifest integrity check failed." };
      }
      const manifest = JSON.parse(manifestRaw) as { files?: Array<{ path: string; sha256: string }> };
      if (!manifest?.files || !Array.isArray(manifest.files)) {
        return { ok: false, message: "manifest.json missing files list." };
      }
      const manifestPaths = manifest.files.map((f) => f.path);
      const allowed = new Set(["manifest.json", ...manifestPaths]);
      const extras = allPaths.filter((p) => !allowed.has(p));
      const missing = manifestPaths.filter((p) => !allPaths.includes(p));
      if (extras.length) return { ok: false, message: `Extra files not in manifest: ${extras.join(", ")}` };
      if (missing.length) return { ok: false, message: `Missing files listed in manifest: ${missing.join(", ")}` };

      const normalizedBundleBytes = bundleJsonBytes(bundleForManifest(parsed));
      for (const file of manifest.files) {
        const entryBytes =
          file.path === "bundle.json"
            ? normalizedBundleBytes
            : new Uint8Array(await zip.file(file.path)!.async("arraybuffer"));
        const actual = await hashBytes(entryBytes);
        if (actual !== file.sha256) {
          return { ok: false, message: `Manifest hash mismatch for ${file.path}.` };
        }
      }
    }
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

    const attachments: Array<{ meta: EvidenceAttachment; bytes: ArrayBuffer }> = [];
    for (const meta of attachmentsMeta) {
      const prefix = `attachments/${meta.id}__`;
      const match = allPaths.filter((p) => p.startsWith(prefix));
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

    if (integrityRecord.zip_sha256) {
      const payloadEntries = allPaths
        .filter((p) => p !== "bundle.json" && p !== "manifest.json")
        .map((p) => p);
      const payload: AuditZipEntry[] = [];
      for (const p of payloadEntries) {
        const bytes = new Uint8Array(await zip.file(p)!.async("arraybuffer"));
        payload.push({ path: p, bytes });
      }
      const payloadZipBytes = await buildZipBytes(payload);
      const payloadSha = await hashBytes(payloadZipBytes);
      if (payloadSha !== integrityRecord.zip_sha256) {
        return { ok: false, message: "Zip integrity check failed." };
      }
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
