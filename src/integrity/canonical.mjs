import { createHash } from "node:crypto";

export function canonicalStringify(value) {
  const seen = new WeakSet();

  function normalize(v) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      if (seen.has(v)) throw new Error("circular structure not allowed");
      seen.add(v);
      return v.map(normalize);
    }
    if (seen.has(v)) throw new Error("circular structure not allowed");
    seen.add(v);
    const record = v;
    const out = {};
    for (const k of Object.keys(record).sort()) out[k] = normalize(record[k]);
    return out;
  }

  return JSON.stringify(normalize(value), null, 2) + "\n";
}

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}
