import { readdir } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "public");
const TARGET_SUFFIX = `${path.sep}derived${path.sep}manifest.json`;

async function findManifest(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (await findManifest(fullPath)) {
        return true;
      }
      continue;
    }
    if (fullPath.endsWith(TARGET_SUFFIX)) {
      return true;
    }
  }
  return false;
}

async function main() {
  const exists = await findManifest(ROOT);
  if (!exists) {
    console.error("❌ No derived manifests found under public/**/derived/manifest.json");
    process.exit(1);
  }
  console.log("✅ Derived manifest present in public/**/derived/manifest.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
