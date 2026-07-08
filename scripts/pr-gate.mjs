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

async function waitForHealth(url, timeoutMs = 120000) {
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

function waitForProcessExit(child, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    child.once("exit", finish);
    setTimeout(finish, timeoutMs);
  });
}

async function main() {
  run("npm run build");
  if (hasScript("test")) run("npm run test");
  if (hasScript("lint")) run("npm run lint");
  if (hasScript("quickcheck:eval:corpus")) run("npm run quickcheck:eval:corpus -- --strict");
  if (hasScript("quickcheck:guard:no-fixture-hardcoding")) run("npm run quickcheck:guard:no-fixture-hardcoding");

  const port = process.env.PORT || "3000";
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  const server = spawn("npm", ["run", "start", "--", "-p", port], {
    stdio: "inherit",
    env: process.env,
  });
  let serverExited = false;
  server.once("exit", () => {
    serverExited = true;
  });

  try {
    const healthTimeoutMs = Number(process.env.HEALTH_TIMEOUT_MS || "120000");
    while (true) {
      if (serverExited) throw new Error("next start exited before /api/health became ready.");
      try {
        await waitForHealth(`${baseUrl}/api/health`, healthTimeoutMs);
        break;
      } catch (error) {
        if (serverExited) throw new Error("next start exited before /api/health became ready.");
        throw error;
      }
    }
    run(`BASE_URL=${baseUrl} npm run test:audit-pack:smoke`);
    run(`BASE_URL=${baseUrl} npm run test:audit-pack:trail-smoke`);
  } finally {
    if (!serverExited) server.kill("SIGTERM");
    await waitForProcessExit(server, 10000);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
