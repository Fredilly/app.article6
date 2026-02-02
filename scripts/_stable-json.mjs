import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const output = {};
    for (const [key, entryValue] of entries) {
      output[key] = normalizeValue(entryValue);
    }
    return output;
  }
  return value;
}

export function stableStringify(value) {
  const normalized = normalizeValue(value);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function sortByPath(a, b) {
  return a.path.localeCompare(b.path);
}

export function sortById(a, b) {
  return a.rule_id.localeCompare(b.rule_id);
}

export async function sha256File(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}
