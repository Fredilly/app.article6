import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { zipSync, strToU8 } from "fflate";

// stable JSON for hashing + export bytes
function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(norm);
    if (seen.has(v)) throw new Error("circular");
    seen.add(v);
    const record = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(record).sort()) out[k] = norm(record[k]);
    return out;
  };
  return JSON.stringify(norm(value)) + "\n";
}
function sha256Hex(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function readJsonCanonical(p: string): Buffer {
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  return Buffer.from(canonicalStringify(parsed), "utf8");
}

function resolveMethodDir(methodCode: string, version: string): string {
  const root = path.join(process.cwd(), "public", "methodologies");
  if (!fs.existsSync(root)) throw new Error("public/methodologies not found");
  // search: public/methodologies/**/<METHOD>/<VERSION>/rules.json
  const needle = path.sep + methodCode + path.sep + version + path.sep + "rules.json";
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && full.endsWith(needle)) return path.dirname(full);
    }
  }
  return "";
}

export function buildAuditPackZip(methodCode: string, version: string) {
  const methodDir = resolveMethodDir(methodCode, version);
  if (!methodDir) {
    throw new Error(`Method/version not found on disk for ${methodCode}@${version} under public/methodologies`);
  }

  const required = ["META.json", "rules.json", "sections.json", "rules.rich.json", "sections.rich.json"];

  const files: { path: string; bytes: Buffer; sha256: string }[] = [];
  for (const name of required) {
    const p = path.join(methodDir, name);
    if (!fs.existsSync(p)) throw new Error(`Missing ${name} in ${methodDir}`);
    const bytes = readJsonCanonical(p);
    files.push({
      path: `data/method/${methodCode}/${version}/${name}`,
      bytes,
      sha256: sha256Hex(bytes),
    });
  }

  const manifest = {
    kind: "article6.audit_pack",
    version: 1,
    generated_at: new Date().toISOString(),
    provenance: {
      repo: process.env.GITHUB_REPOSITORY || process.env.VERCEL_GIT_REPO_SLUG || "unknown",
      commit: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    },
    method: { code: methodCode, version },
    source: { methodDir: path.relative(process.cwd(), methodDir) },
    files: files
      .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes.length }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };

  // Zip entries (sorted for stability)
  const entries: Record<string, Uint8Array> = {
    "manifest.json": strToU8(canonicalStringify(manifest)),
  };
  for (const f of files.sort((a, b) => a.path.localeCompare(b.path))) {
    entries[f.path] = new Uint8Array(f.bytes);
  }

  const zipped = zipSync(entries, { level: 0 }); // store only; determinism cleanup in PR9
  return Buffer.from(zipped);
}
