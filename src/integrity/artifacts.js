const crypto = require("node:crypto");

function canonicalizeValue(value, seen) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry, seen));

  if (seen.has(value)) throw new Error("circular structure not allowed");
  seen.add(value);

  const record = value;
  const out = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = canonicalizeValue(record[key], seen);
  }
  return out;
}

function canonicalStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(canonicalizeValue(value, seen), null, 2) + "\n";
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = { canonicalStringify, sha256Hex };
