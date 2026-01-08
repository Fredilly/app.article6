export function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  function normalize(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;

    if (Array.isArray(v)) {
      if (seen.has(v)) throw new Error("circular structure not allowed");
      seen.add(v);
      return v.map(normalize);
    }

    if (seen.has(v)) throw new Error("circular structure not allowed");
    seen.add(v);

    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = normalize(obj[k]);
    return out;
  }

  return JSON.stringify(normalize(value)) + "\n";
}
