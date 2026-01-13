#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";

function run(cmd, env) {
  execSync(cmd, { stdio: "inherit", env: env ?? process.env });
}

function hasScript(name) {
  try {
    const pkg = JSON.parse(
      execSync(
        "node -e \"console.log(JSON.stringify(require('./package.json').scripts || {}))\"",
        { encoding: "utf8" },
      ),
    );
    return Boolean(pkg && pkg[name]);
  } catch {
    return false;
  }
}

async function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  run("npm run build");
  if (hasScript("test")) run("npm run test");
  if (hasScript("lint")) run("npm run lint");

  const port = process.env.PORT || "3000";
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  const server = spawn("npm", ["run", "start", "--", "-p", port], {
    stdio: "inherit",
    env: process.env,
  });

  try {
    await waitForHealth(`${baseUrl}/api/health`);
    run(`BASE_URL=${baseUrl} npm run test:audit-pack:smoke`);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
