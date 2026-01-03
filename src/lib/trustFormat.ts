type AuditHashes = {
  rules?: string;
  sections?: string;
  sourcePdf?: string;
};

export type PickedProvenance = {
  repo?: string;
  sha?: string;
  packTag?: string;
  packSha?: string;
  generatedAt?: string;
  auditHashes?: AuditHashes;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(root: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = root[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

export function shortSha(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (/^[0-9a-f]{12,}$/i.test(lower)) return lower.slice(0, 12);
  return value;
}

export function formatIso(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").replace(".000Z", "Z");
}

export function pickProvenanceFields(provJson: unknown): PickedProvenance {
  const root = asRecord(provJson);
  if (!root) return {};

  const nestedProvenance = asRecord(root.provenance) ?? {};

  const repo =
    pickString(root, ["repo"]) ??
    pickString(nestedProvenance, ["repo", "repository"]) ??
    undefined;

  const sha =
    pickString(root, ["sha"]) ??
    pickString(nestedProvenance, ["sha", "commit_sha", "commit"]) ??
    undefined;

  const packTag =
    pickString(root, ["tag", "pack_tag"]) ??
    pickString(nestedProvenance, ["tag", "pack_tag"]) ??
    (typeof getPath(root, ["provenance", "pack", "tag"]) === "string"
      ? String(getPath(root, ["provenance", "pack", "tag"]))
      : undefined);

  const packSha =
    pickString(root, ["pack_sha"]) ??
    pickString(nestedProvenance, ["pack_sha"]) ??
    (typeof getPath(root, ["provenance", "pack", "sha"]) === "string"
      ? String(getPath(root, ["provenance", "pack", "sha"]))
      : undefined);

  const generatedAt =
    pickString(root, ["generated_at", "generatedAt"]) ??
    pickString(nestedProvenance, ["generated_at", "generatedAt", "date"]) ??
    undefined;

  const auditHashesRecord = asRecord(root.audit_hashes) ?? asRecord(getPath(root, ["audit_hashes"])) ?? null;
  const auditHashes: AuditHashes | undefined = auditHashesRecord
    ? {
        rules: pickString(auditHashesRecord, ["rules_json_sha256", "rulesSha256", "rules_sha256"]),
        sections: pickString(auditHashesRecord, ["sections_json_sha256", "sectionsSha256", "sections_sha256"]),
        sourcePdf: pickString(auditHashesRecord, ["source_pdf_sha256", "sourcePdfSha256", "pdf_sha256"]),
      }
    : undefined;

  return {
    repo,
    sha,
    packTag,
    packSha,
    generatedAt,
    auditHashes:
      auditHashes && (auditHashes.rules || auditHashes.sections || auditHashes.sourcePdf)
        ? auditHashes
        : undefined,
  };
}

