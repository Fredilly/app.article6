#!/usr/bin/env node
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'methodologies');
const OUT = path.join(process.cwd(), 'public', 'manifest', 'index.json');

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function fileExists(fp) {
  try { await stat(fp); return true; }
  catch { return false; }
}

async function readJson(fp) {
  return JSON.parse(await readFile(fp, 'utf8'));
}

async function* walkMethodologies(dir, provider) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Check if this is a version directory (contains rules.json + META.json)
      const rulesPath = path.join(fullPath, 'rules.json');
      const metaPath = path.join(fullPath, 'META.json');
      if (entry.name.startsWith('v') && await fileExists(rulesPath) && await fileExists(metaPath)) {
        const parts = fullPath.replace(ROOT, '').split(path.sep).filter(Boolean);
        const methodName = parts[parts.length - 2]; // e.g. VM0007
        const version = entry.name;
        const category = parts[parts.length - 3]; // e.g. AFOLU (domain)
        const providerDir = parts[0]; // e.g. Verra
        yield { dir: fullPath, rulesPath, metaPath, methodName, version, category, provider: providerDir };
      } else {
        // Recurse into provider/category/methodology directories
        yield* walkMethodologies(fullPath, entry.name);
      }
    }
  }
}

async function main() {
  const outDir = path.dirname(OUT);
  if (!(await fileExists(outDir))) {
    throw new Error(`Output directory ${outDir} does not exist`);
  }

  const allEntries = [];

  for await (const m of walkMethodologies(ROOT, '')) {
    const rules = await readJson(m.rulesPath);
    const rulesList = Array.isArray(rules.rules) ? rules.rules : Array.isArray(rules) ? rules : [];
    const meta = await readJson(m.metaPath);
    const domain = meta.domain || m.category;

    for (const rule of rulesList) {
      if (!rule.id && !rule.rule_id) continue;
      const ruleId = rule.id || rule.rule_id;
      const ruleText = rule.title || rule.rule || rule.text || '';
      if (!ruleText.trim()) continue;
      const tags = Array.isArray(rule.tags) ? rule.tags : [];
      const sectionId = rule.section_id || rule.sectionId || '';

      const manifestEntry = {
        id: ruleId,
        rule_id: ruleId,
        methodology: m.methodName,
        version: m.version,
        rule: ruleText,
        tags,
        provider: m.provider,
        category: domain,
        path: `methodologies/${m.provider}/${m.category}/${m.methodName}/${m.version}/rules.json`,
        sectionId,
      };

      // Compute sha256 over the manifest entry itself (matching existing convention)
      const entryStr = JSON.stringify(manifestEntry, Object.keys(manifestEntry).sort());
      manifestEntry.sha256 = sha256(entryStr);

      allEntries.push(manifestEntry);
    }
  }

  allEntries.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    if (a.methodology !== b.methodology) return a.methodology.localeCompare(b.methodology);
    if (a.version !== b.version) return a.version.localeCompare(b.version);
    return a.id.localeCompare(b.id);
  });

  await writeFile(OUT, JSON.stringify(allEntries, null, 2) + '\n', 'utf8');
  console.log(`Generated manifest: ${allEntries.length} entries from ${new Set(allEntries.map(e => e.methodology)).size} methodologies`);
  const providers = [...new Set(allEntries.map(e => e.provider))];
  console.log(`Providers: ${providers.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
