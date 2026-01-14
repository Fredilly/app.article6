import fs from "node:fs";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { makePackMeta } from "./packMeta";
import { canonicalStringify, sha256Hex } from "../integrity/artifacts";
import { buildTraceIndex } from "../lib/trace/traceIndex";

function readJsonCanonical(p: string): Buffer {
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  return Buffer.from(canonicalStringify(parsed), "utf8");
}

function readJsonRaw(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, "utf8"));
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

function deterministicTimestamp(): string {
  if (process.env.SOURCE_DATE_EPOCH) {
    const parsed = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(parsed)) {
      return new Date(parsed * 1000).toISOString();
    }
  }
  return "1970-01-01T00:00:00.000Z";
}

function zipMtimeFromTimestamp(iso: string): Date {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return new Date("1980-01-01T00:00:00.000Z");
  if (date.getUTCFullYear() < 1980) return new Date("1980-01-01T00:00:00.000Z");
  if (date.getUTCFullYear() > 2099) return new Date("2099-12-31T23:59:58.000Z");
  return date;
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

  const rulesPath = path.join(methodDir, "rules.json");
  const sectionsPath = path.join(methodDir, "sections.json");
  const trace = buildTraceIndex({
    method: { code: methodCode, version },
    rules: readJsonRaw(rulesPath),
    sections: readJsonRaw(sectionsPath),
  });
  const traceBytes = Buffer.from(canonicalStringify(trace), "utf8");
  files.push({
    path: "trace.json",
    bytes: traceBytes,
    sha256: sha256Hex(traceBytes),
  });

  const repo = process.env.GITHUB_REPOSITORY || process.env.VERCEL_GIT_REPO_SLUG || "unknown";
  const commit = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown";

  const generatedAt = deterministicTimestamp();
  const packMeta = makePackMeta({ methodCode, version, repo, commit, generated_at: generatedAt });

  const manifest = {
    kind: "article6.audit_pack",
    version: 1,
    generated_at: generatedAt,
    provenance: {
      repo,
      commit,
    },
    method: { code: methodCode, version },
    source: { methodDir: path.relative(process.cwd(), methodDir) },
    files: files
      .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes.length }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };

  const packMetaBytes = Buffer.from(canonicalStringify(packMeta), "utf8");
  files.push({
    path: "pack.meta.json",
    bytes: packMetaBytes,
    sha256: sha256Hex(packMetaBytes),
  });

  const registryCandidates = [
    path.join(process.cwd(), "public", "registry.json"),
    path.join(process.cwd(), "public", "methodologies", "registry.json"),
    path.join(process.cwd(), "data", "registry.json"),
  ];
  for (const candidate of registryCandidates) {
    if (!fs.existsSync(candidate)) continue;
    const registryBytes = readJsonCanonical(candidate);
    files.push({
      path: "registry.json",
      bytes: registryBytes,
      sha256: sha256Hex(registryBytes),
    });
    break;
  }

  manifest.files = files
    .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes.length }))
    .sort((a, b) => a.path.localeCompare(b.path));

  // Zip entries (sorted for stability)
  const entryMtime = zipMtimeFromTimestamp(generatedAt);
  const entries: Record<string, Uint8Array | [Uint8Array, { mtime: Date }]> = {
    "manifest.json": [strToU8(canonicalStringify(manifest)), { mtime: entryMtime }],
  };
  for (const f of files.sort((a, b) => a.path.localeCompare(b.path))) {
    entries[f.path] = [new Uint8Array(f.bytes), { mtime: entryMtime }];
  }

  const zipped = zipSync(entries, { level: 0 }); // store only; determinism cleanup in PR9
  return Buffer.from(zipped);
}
