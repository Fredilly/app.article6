import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import JSZip from "jszip";

const repoRoot = process.cwd();

const DEFAULT_ROOTS = ["methodologies", "public", "data", "artifacts", "src/data"].map((p) => path.join(repoRoot, p));
const artifactRoots = (process.env.ARTIFACT_ROOTS
  ? process.env.ARTIFACT_ROOTS.split(",").map((s) => path.join(repoRoot, s.trim()))
  : DEFAULT_ROOTS
).filter((p) => fs.existsSync(p));

function canonicalStringify(value) {
  const seen = new WeakSet();
  const normalize = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      if (seen.has(v)) throw new Error("circular structure not allowed");
      seen.add(v);
      return v.map(normalize);
    }
    if (seen.has(v)) throw new Error("circular structure not allowed");
    seen.add(v);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = normalize(v[k]);
    return out;
  };
  return JSON.stringify(normalize(value)) + "\n";
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else yield fullPath;
  }
}

function include(absPath) {
  return /registry\.json$|META\.json$|rules\.json$|sections\.json$|rules\.rich\.json$|sections\.rich\.json$/i.test(absPath);
}

const found = [];
for (const root of artifactRoots) {
  for (const abs of walk(root)) {
    if (!include(abs)) continue;
    const rel = path.relative(repoRoot, abs).replaceAll("\\", "/");
    found.push({ abs, rel });
  }
}

if (found.length === 0) {
  console.error("No artifacts matched include patterns under artifact roots.");
  process.exit(2);
}

found.sort((a, b) => a.rel.localeCompare(b.rel));

const zip = new JSZip();
const files = [];

for (const f of found) {
  const raw = fs.readFileSync(f.abs);
  const lower = f.rel.toLowerCase();

  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(raw.toString("utf8"));
    const canonicalBytes = Buffer.from(canonicalStringify(parsed), "utf8");
    const sha256 = sha256Hex(canonicalBytes);
    zip.file(f.rel, canonicalBytes);
    files.push({ path: f.rel, sha256, bytes: canonicalBytes.length });
    continue;
  }

  const sha256 = sha256Hex(raw);
  zip.file(f.rel, raw);
  files.push({ path: f.rel, sha256, bytes: raw.length });
}

const manifest = {
  kind: "article6.audit_pack",
  version: 1,
  generated_at: new Date(0).toISOString(),
  provenance: {
    repo: process.env.GITHUB_REPOSITORY || process.env.VERCEL_GIT_REPO_SLUG || "unknown",
    commit: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
  },
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
};

zip.file("manifest.json", Buffer.from(canonicalStringify(manifest), "utf8"));

const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

const outPath = path.join(repoRoot, "public", "exports", "audit-pack.zip");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, zipBytes);

console.log(`audit-pack built: ${path.relative(repoRoot, outPath)} (files=${manifest.files.length})`);

