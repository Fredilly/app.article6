#!/usr/bin/env node
/**
 * Post-generation script that injects Gold Standard manifest entries
 * into the generated manifest. GS entries are stored in data/gs-manifest-entries.json
 * and merged into public/manifest/index.json after the main generator runs.
 *
 * This avoids dependency on the upstream methodologies pack for GS data
 * until GS methods are added to the upstream repo.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'manifest', 'index.json');
const GS_ENTRIES_PATH = path.join(process.cwd(), 'data', 'gs-manifest-entries.json');

async function main() {
  const [manifestRaw, gsRaw] = await Promise.all([
    readFile(MANIFEST_PATH, 'utf8'),
    readFile(GS_ENTRIES_PATH, 'utf8'),
  ]);

  const manifest = JSON.parse(manifestRaw);
  const gsEntries = JSON.parse(gsRaw);

  if (!Array.isArray(manifest) || !Array.isArray(gsEntries)) {
    console.error('Invalid JSON format in manifest or GS entries');
    process.exit(1);
  }

  // Check if GS entries already present
  const existingGs = manifest.filter(e => e.provider === 'GoldStandard');
  if (existingGs.length > 0) {
    console.log(`Gold Standard entries already in manifest (${existingGs.length}), skipping patch.`);
    return;
  }

  // Merge and re-sort
  const merged = [...manifest, ...gsEntries];
  merged.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    if (a.methodology !== b.methodology) return a.methodology.localeCompare(b.methodology);
    if (a.version !== b.version) return a.version.localeCompare(b.version);
    return a.id.localeCompare(b.id);
  });

  await writeFile(MANIFEST_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Patched manifest: ${manifest.length} → ${merged.length} entries (added ${gsEntries.length} Gold Standard entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
