#!/usr/bin/env node
import path from "node:path";
import { readFile, readdir, access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { sha256File } from "./_stable-json.mjs";

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function dirExists(dirPath) {
  try {
    const info = await stat(dirPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function collectDatasets(manifest) {
  const map = new Map();
  for (const entry of manifest) {
    if (!entry || typeof entry !== "object") continue;
    const methodCode = entry.methodology;
    const version = entry.version;
    const rulesPath = entry.path;
    if (!methodCode || !version || !rulesPath) continue;
    const key = `${methodCode}@${version}`;
    if (map.has(key)) continue;
    const baseDir = path.join(process.cwd(), "public", path.dirname(rulesPath));
    if (!(await dirExists(baseDir))) continue;
    map.set(key, { methodCode, version, baseDir });
  }
  return Array.from(map.values());
}

async function main() {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  if (!(await fileExists(manifestPath))) {
    throw new Error("Derived verifier: manifest index missing.");
  }
  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) {
    throw new Error("Derived verifier: manifest index invalid.");
  }

  const datasets = await collectDatasets(manifest);

  for (const dataset of datasets) {
    const derivedDir = path.join(dataset.baseDir, "derived");
    const manifestFile = path.join(derivedDir, "manifest.json");
    if (!(await fileExists(manifestFile))) {
      throw new Error(`Derived verifier: missing manifest.json at ${manifestFile}`);
    }

    const manifestJson = await readJson(manifestFile);
    const derivedFiles = Array.isArray(manifestJson?.derived_files) ? manifestJson.derived_files : null;
    if (!derivedFiles) {
      throw new Error(`Derived verifier: invalid manifest at ${manifestFile}`);
    }

    const listed = new Map();
    for (const entry of derivedFiles) {
      if (!entry || typeof entry !== "object") continue;
      const relPath = typeof entry.path === "string" ? entry.path : null;
      const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : null;
      if (!relPath || !sha256) {
        throw new Error(`Derived verifier: invalid manifest entry in ${manifestFile}`);
      }
      listed.set(relPath, sha256);
    }

    const entries = await readdir(derivedDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const derivedFileNames = files.filter((name) => name !== "manifest.json");

    for (const name of derivedFileNames) {
      const relPath = `derived/${name}`;
      if (!listed.has(relPath)) {
        throw new Error(`Derived verifier: extra file ${relPath} in ${derivedDir}`);
      }
    }

    for (const [relPath, expectedSha] of listed.entries()) {
      const name = relPath.replace(/^derived\//, "");
      const fullPath = path.join(derivedDir, name);
      if (!(await fileExists(fullPath))) {
        throw new Error(`Derived verifier: missing file ${relPath} in ${derivedDir}`);
      }
      const actualSha = await sha256File(fullPath);
      if (actualSha !== expectedSha) {
        throw new Error(`Derived verifier: sha mismatch for ${relPath}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
