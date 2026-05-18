#!/usr/bin/env node
import path from "node:path";
import { readdir, readFile, writeFile, stat, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { stableStringify, sortByPath, sha256File } from "./_stable-json.mjs";

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

function collectDatasets(manifest) {
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
    map.set(key, { methodCode, version, baseDir });
  }
  return Array.from(map.values());
}

async function main() {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  if (!(await fileExists(manifestPath))) {
    throw new Error("Derived manifest: manifest index missing.");
  }
  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) {
    throw new Error("Derived manifest: manifest index invalid.");
  }

  const datasets = collectDatasets(manifest);

  for (const dataset of datasets) {
    const derivedDir = path.join(dataset.baseDir, "derived");
    if (!(await fileExists(derivedDir))) {
      throw new Error(`Derived manifest: missing derived directory at ${derivedDir}`);
    }

    const entries = await readdir(derivedDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const derivedFiles = files.filter((name) => name !== "manifest.json");

    const derivedRecords = [];
    for (const name of derivedFiles) {
      const fullPath = path.join(derivedDir, name);
      const stats = await stat(fullPath);
      const sha256 = await sha256File(fullPath);
      derivedRecords.push({ path: `derived/${name}`, sha256, bytes: stats.size });
    }

    derivedRecords.sort(sortByPath);

    const manifestOut = {
      version: 1,
      derived_files: derivedRecords,
      note: "sha256 over exact file bytes",
    };

    const manifestOutPath = path.join(derivedDir, "manifest.json");
    await writeFile(manifestOutPath, stableStringify(manifestOut), "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
