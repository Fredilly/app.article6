#!/usr/bin/env node
import path from "node:path";
import { execSync } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

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

async function loadManifestTexts() {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  if (!(await fileExists(manifestPath))) {
    throw new Error("Determinism: manifest index missing.");
  }
  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) {
    throw new Error("Determinism: manifest index invalid.");
  }
  const datasets = collectDatasets(manifest);
  const output = new Map();
  for (const dataset of datasets) {
    const manifestFile = path.join(dataset.baseDir, "derived", "manifest.json");
    if (!(await fileExists(manifestFile))) {
      throw new Error(`Determinism: missing manifest at ${manifestFile}`);
    }
    const text = await readFile(manifestFile, "utf8");
    output.set(manifestFile, text);
  }
  return output;
}

async function main() {
  execSync("npm run derive:all", { stdio: "inherit" });
  const first = await loadManifestTexts();
  execSync("npm run derive:all", { stdio: "inherit" });
  const second = await loadManifestTexts();

  for (const [filePath, text] of first.entries()) {
    const next = second.get(filePath);
    if (next !== text) {
      throw new Error(`Determinism: manifest mismatch at ${filePath}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
