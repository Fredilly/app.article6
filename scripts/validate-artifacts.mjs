import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv/dist/2020.js";
import { canonicalStringify } from "../src/integrity/canonical.mjs";

const REPO_ROOT = process.cwd();
const SCHEMA_DIR = path.join(REPO_ROOT, "schemas", "artifacts");

const DEFAULT_ROOTS = ["methodologies", "public", "data", "artifacts", "src/data"].map((p) =>
  path.join(REPO_ROOT, p),
);

const ROOTS = (
  process.env.ARTIFACT_ROOTS
    ? process.env.ARTIFACT_ROOTS.split(",").map((s) => path.join(REPO_ROOT, s.trim()))
    : DEFAULT_ROOTS
).filter((p) => fs.existsSync(p));

if (ROOTS.length === 0) {
  console.error("No artifact roots found. Set ARTIFACT_ROOTS=dir1,dir2 (relative to repo root).");
  process.exit(2);
}

function schemaNameForFile(filePath) {
  const base = path.basename(filePath);
  if (base === "registry.json") return "registry.schema.json";
  if (base === "META.json") return "meta.schema.json";
  if (base === "rules.json") return "rules.schema.json";
  if (base === "sections.json") return "sections.schema.json";
  if (base.endsWith("rules.rich.json")) return "rules.rich.schema.json";
  if (base.endsWith("sections.rich.json")) return "sections.rich.schema.json";
  return null;
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else yield fullPath;
  }
}

if (!fs.existsSync(SCHEMA_DIR)) {
  console.error(`Schema directory missing: ${path.relative(REPO_ROOT, SCHEMA_DIR)}`);
  process.exit(2);
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });

function loadSchema(schemaFile) {
  const full = path.join(SCHEMA_DIR, schemaFile);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const schemaCache = new Map();
function getValidator(schemaFile) {
  if (!schemaCache.has(schemaFile)) {
    schemaCache.set(schemaFile, ajv.compile(loadSchema(schemaFile)));
  }
  return schemaCache.get(schemaFile);
}

const targets = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const schemaFile = schemaNameForFile(file);
    if (schemaFile) targets.push({ file, schemaFile });
  }
}

if (targets.length === 0) {
  console.error(
    `No artifacts found under roots: ${ROOTS.map((r) => path.relative(REPO_ROOT, r)).join(", ")}.`,
  );
  console.error("If your artifacts live elsewhere, set ARTIFACT_ROOTS=relative/path,another/path");
  process.exit(2);
}

let ok = 0;
let fail = 0;

for (const t of targets) {
  try {
    const raw = fs.readFileSync(t.file, "utf8");
    const data = JSON.parse(raw);

    const validate = getValidator(t.schemaFile);
    const valid = validate(data);
    if (!valid) {
      fail++;
      console.error(`❌ INVALID  ${path.relative(REPO_ROOT, t.file)} (${t.schemaFile})`);
      for (const err of validate.errors || []) {
        console.error(`   - ${err.instancePath || "/"} ${err.message}`);
      }
      continue;
    }

    const canonical = canonicalStringify(data);
    if (canonical !== raw) {
      fail++;
      console.error(`❌ NONCANON ${path.relative(REPO_ROOT, t.file)}`);
      continue;
    }

    ok++;
  } catch (error) {
    fail++;
    console.error(`❌ ERROR   ${path.relative(REPO_ROOT, t.file)}: ${error?.message || error}`);
  }
}

const rootsStr = ROOTS.map((r) => path.relative(REPO_ROOT, r)).join(", ");
console.log(`validate-artifacts: roots=[${rootsStr}] targets=${targets.length} ok=${ok} fail=${fail}`);

if (fail > 0) process.exit(1);
