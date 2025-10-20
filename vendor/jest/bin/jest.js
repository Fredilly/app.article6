#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const rawArgs = process.argv.slice(2);
if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
  process.stdout.write(pkg.version + '\n');
  process.exit(0);
}

const unsupportedFlags = ['--watch', '--watchAll', '--interactive', '--runInBand'];
const warned = [];
for (const flag of unsupportedFlags) {
  const idx = rawArgs.indexOf(flag);
  if (idx !== -1) {
    warned.push(flag);
    rawArgs.splice(idx, 1);
  }
}
if (warned.length > 0) {
  console.warn(
    `[jest-shim] Ignoring unsupported flags: ${warned.join(', ')} (run uses vitest under the hood)`
  );
}

let vitestEntry;
try {
  vitestEntry = require.resolve('vitest/vitest.mjs');
} catch (error) {
  console.error('[jest-shim] Unable to resolve vitest. Ensure it is installed as a devDependency.');
  console.error(error);
  process.exit(1);
}

const forwardArgs = ['run', ...rawArgs];
const result = spawnSync(process.execPath, [vitestEntry, ...forwardArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    JEST_WORKER_ID: '1',
    VITEST_JEST_SHIM: '1'
  }
});

if (result.error) {
  console.error('[jest-shim] Failed to execute vitest:', result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
