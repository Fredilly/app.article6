import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { canonicalStringify, sha256Hex } from "@/integrity/artifacts";

type PackFileEntry = { path: string; sha256: string; bytes: number };

export type AuditPackManifest = {
  kind: "article6.audit_pack";
  version: 1;
  generated_at: string;
  provenance: {
    repo: string;
    commit: string;
  };
  files: PackFileEntry[];
};

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else yield fullPath;
  }
}

function defaultInclude(absPath: string): boolean {
  return /registry\.json$|META\.json$|rules\.json$|sections\.json$|rules\.rich\.json$|sections\.rich\.json$/i.test(absPath);
}

export async function buildAuditPack(opts: {
  repoRoot: string;
  artifactRoots: string[];
  includePatterns?: RegExp[];
}): Promise<{ zipBytes: Buffer; manifest: AuditPackManifest }> {
  const include = opts.includePatterns?.length
    ? (p: string) => opts.includePatterns!.some((r) => r.test(p))
    : defaultInclude;

  const found: { abs: string; rel: string }[] = [];
  for (const root of opts.artifactRoots) {
    if (!fs.existsSync(root)) continue;
    for (const abs of walk(root)) {
      if (!include(abs)) continue;
      const rel = path.relative(opts.repoRoot, abs).replaceAll("\\", "/");
      found.push({ abs, rel });
    }
  }

  if (found.length === 0) throw new Error("No artifacts matched include patterns under artifact roots.");

  found.sort((a, b) => a.rel.localeCompare(b.rel));

  const zip = new JSZip();
  const files: PackFileEntry[] = [];

  for (const f of found) {
    const raw = fs.readFileSync(f.abs);

    if (f.rel.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(raw.toString("utf8")) as unknown;
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

  const manifest: AuditPackManifest = {
    kind: "article6.audit_pack",
    version: 1,
    generated_at: new Date(0).toISOString(),
    provenance: {
      repo: process.env.GITHUB_REPOSITORY || process.env.VERCEL_GIT_REPO_SLUG || "unknown",
      commit: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    },
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };

  const manifestBytes = Buffer.from(canonicalStringify(manifest), "utf8");
  zip.file("manifest.json", manifestBytes);

  const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { zipBytes, manifest };
}
