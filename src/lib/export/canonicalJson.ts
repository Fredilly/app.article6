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

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value), null, 2);
}

