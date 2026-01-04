import type { PickedProvenance } from "@/lib/trustFormat";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import { kindFromCitedId } from "@/lib/proofMap/pins";

export type ProofEvidenceItem = {
  id: string;
  kind: "rule" | "section";
  title?: string;
  snippet?: string;
  stable_ref?: string;
};

export type ProofBundleV1 = {
  bundle_version: "proof-bundle@1";
  exported_at: string;
  method: {
    program?: string;
    sector?: string;
    code: string;
    version: string;
    source: string;
    generated_at?: string;
  };
  provenance: {
    repo?: string;
    commit?: string;
    pack_digest?: string;
  };
  aoi?: AOI | null;
  evidence_pins?: EvidencePin[];
  evidence_items?: ProofEvidenceItem[];
  integrity: { sha256: string };
};

export type ProofBundleIntegrityCheck =
  | { ok: true; expected: string; actual: string }
  | { ok: false; expected: string; actual: string };

type RuleSummary = { id: string; title: string; snippet: string };
type SectionSummary = { id: string; title: string; textSnippet?: string };

function nowIso(): string {
  return new Date().toISOString();
}

function capSnippet(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
}

function stableRef(code: string, version: string, kind: "rule" | "section", id: string): string {
  const base = `/m/${encodeURIComponent(code)}/v/${encodeURIComponent(version)}`;
  const key = kind === "rule" ? "rule" : "section";
  return `${base}?${key}=${encodeURIComponent(id)}`;
}

export function buildEvidenceSnapshot(input: {
  methodCode: string;
  version: string;
  evidencePins: EvidencePin[];
  rules: RuleSummary[];
  sections: SectionSummary[];
}): ProofEvidenceItem[] {
  const citedIds: string[] = [];
  const seen = new Set<string>();

  for (const pin of input.evidencePins) {
    for (const raw of pin.cited_ids ?? []) {
      const id = String(raw).trim();
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      citedIds.push(id);
    }
  }

  const rulesById = new Map(input.rules.map((r) => [r.id, r]));
  const sectionsById = new Map(input.sections.map((s) => [s.id, s]));

  const items: ProofEvidenceItem[] = [];
  for (const id of citedIds) {
    const kind = kindFromCitedId(id);
    if (!kind) continue;
    if (kind === "rule") {
      const rule = rulesById.get(id);
      items.push({
        id,
        kind,
        title: rule?.title,
        snippet: rule?.snippet ? capSnippet(rule.snippet, 240) : undefined,
        stable_ref: stableRef(input.methodCode, input.version, "rule", id),
      });
      continue;
    }
    const section = sectionsById.get(id);
    items.push({
      id,
      kind,
      title: section?.title,
      snippet: section?.textSnippet ? capSnippet(section.textSnippet, 240) : undefined,
      stable_ref: stableRef(input.methodCode, input.version, "section", id),
    });
  }

  return items;
}

function canonicalizeValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeValue);

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = canonicalizeValue(record[key]);
  }
  return out;
}

export function canonicalizeProofBundleForHash(bundle: Omit<ProofBundleV1, "integrity"> & { integrity?: unknown }): string {
  const withoutSha: Record<string, unknown> = { ...(bundle as Record<string, unknown>) };
  withoutSha.integrity = {};
  return JSON.stringify(canonicalizeValue(withoutSha));
}

export async function sha256Hex(input: string): Promise<string> {
  const data =
    typeof globalThis.TextEncoder !== "undefined"
      ? new globalThis.TextEncoder().encode(input)
      : // Node/Jest fallback (Buffer exists server-side).
        new Uint8Array(Buffer.from(input, "utf8"));
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback for environments without WebCrypto (should be rare).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto");
  return nodeCrypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
}

export function isProofBundleV1(value: unknown): value is ProofBundleV1 {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.bundle_version !== "proof-bundle@1") return false;
  if (!record.method || typeof record.method !== "object") return false;
  if (!record.integrity || typeof record.integrity !== "object") return false;
  const integrity = record.integrity as Record<string, unknown>;
  return typeof integrity.sha256 === "string" && integrity.sha256.length >= 16;
}

export async function verifyProofBundleIntegrity(bundle: ProofBundleV1): Promise<ProofBundleIntegrityCheck> {
  const canonical = canonicalizeProofBundleForHash(bundle);
  const actual = await sha256Hex(canonical);
  const expected = bundle.integrity.sha256;
  if (actual === expected) return { ok: true, expected, actual };
  return { ok: false, expected, actual };
}

export async function buildProofBundleV1(input: {
  program?: string;
  sector?: string;
  code: string;
  version: string;
  source: string;
  generated_at?: string;
  provenance: PickedProvenance;
  pack_digest?: string;
  aoi?: AOI | null;
  evidence_pins?: EvidencePin[];
  rules: RuleSummary[];
  sections: SectionSummary[];
}): Promise<ProofBundleV1> {
  const exported_at = nowIso();
  const evidence_pins = input.evidence_pins && input.evidence_pins.length ? input.evidence_pins : undefined;
  const evidence_items = evidence_pins
    ? buildEvidenceSnapshot({
        methodCode: input.code,
        version: input.version,
        evidencePins: evidence_pins,
        rules: input.rules,
        sections: input.sections,
      })
    : undefined;

  const bundle: ProofBundleV1 = {
    bundle_version: "proof-bundle@1",
    exported_at,
    method: {
      program: input.program,
      sector: input.sector,
      code: input.code,
      version: input.version,
      source: input.source,
      generated_at: input.generated_at,
    },
    provenance: {
      repo: input.provenance.repo,
      commit: input.provenance.sha,
      pack_digest: input.pack_digest,
    },
    aoi: input.aoi ?? undefined,
    evidence_pins,
    evidence_items,
    integrity: { sha256: "" },
  };

  const canonical = canonicalizeProofBundleForHash(bundle);
  bundle.integrity.sha256 = await sha256Hex(canonical);
  return bundle;
}
