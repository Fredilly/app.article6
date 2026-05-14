/**
 * Strip the last path segment from a slash-delimited path.
 * Returns "/" for root paths, "" for empty input.
 */
export function dirnameFromPath(value: string): string {
  const idx = value.lastIndexOf("/");
  return idx >= 0 ? value.slice(0, idx) || "/" : "";
}

/**
 * Derive the META.json URL from a manifest rules path.
 *
 * Given `methodologies/Verra/AFOLU/VM0047/v1-0/rules.json`
 * Returns `methodologies/Verra/AFOLU/VM0047/v1-0/META.json`
 *
 * Handles both `rules.json` and `rules.rich.json` filenames.
 */
export function metaUrlFromRulesPath(rulesPath: string | null | undefined): string | null {
  if (!rulesPath) return null;
  const dir = dirnameFromPath(rulesPath);
  return dir ? `${dir}/META.json` : null;
}

export function isSourceAuditedMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  const status = m.artifact_status as Record<string, unknown> | undefined;
  if (!status || typeof status !== "object") return false;
  if (status.rules !== "source_audited") return false;
  if (status.sections !== "source_audited") return false;
  if (status.source_pdf !== "verified") return false;
  if (m.methodology_linked_review_ready !== true) return false;
  const blockers = m.methodology_linked_review_blockers;
  if (!Array.isArray(blockers) || blockers.length !== 0) return false;
  const quality = m.artifact_quality_standard as Record<string, unknown> | undefined;
  if (!quality || typeof quality !== "object") return false;
  const adoption = quality.adoption_status;
  if (adoption !== "source_audited" && adoption !== "s_grade" && adoption !== "grade_a") return false;
  return true;
}
