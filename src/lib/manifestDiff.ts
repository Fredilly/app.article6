export type ManifestIndex = Map<string, string>;

export function indexManifest(manifest: unknown): ManifestIndex {
  const m: ManifestIndex = new Map();

  if (Array.isArray((manifest as { files?: unknown })?.files)) {
    for (const f of (manifest as { files: Array<{ path?: unknown; sha256?: unknown }> }).files) {
      if (f?.path && typeof f.sha256 === "string") m.set(String(f.path), f.sha256);
    }
    return m;
  }

  for (const [k, v] of Object.entries((manifest as Record<string, unknown>) ?? {})) {
    if (typeof v === "string") m.set(String(k), v);
    else if (v && typeof v === "object" && typeof (v as { sha256?: unknown }).sha256 === "string") {
      m.set(String(k), (v as { sha256: string }).sha256);
    }
  }
  return m;
}

export function diffIndexes(A: ManifestIndex, B: ManifestIndex) {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const k of A.keys()) if (!B.has(k)) removed.push(k);
  for (const k of B.keys()) if (!A.has(k)) added.push(k);
  for (const k of A.keys()) if (B.has(k) && A.get(k) !== B.get(k)) changed.push(k);

  added.sort();
  removed.sort();
  changed.sort();

  return {
    version: 1,
    counts: { added: added.length, removed: removed.length, changed: changed.length },
    added,
    removed,
    changed,
  };
}
