#!/usr/bin/env node
import { spawn, spawnSync, execSync } from "node:child_process";

function runStage(name, command, args, env, displayedCommand) {
  console.log(`\n=== ${name} ===`);
  console.log(`$ ${displayedCommand ?? `${command} ${args.join(" ")}`}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: env ?? process.env,
  });
  if (result.error) throw Object.assign(result.error, { stage: name });
  if (result.status !== 0) {
    const error = new Error(`${name} failed`);
    error.stage = name;
    error.exitCode = result.status ?? 1;
    throw error;
  }
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
  runStage("build", "npm", ["run", "build"]);
  if (hasScript("test")) runStage("test", "npm", ["run", "test"]);
  if (hasScript("lint")) runStage("lint", "npm", ["run", "lint"]);
  if (hasScript("quickcheck:eval:corpus")) {
    runStage("quickcheck:eval:corpus -- --strict", "npm", ["run", "quickcheck:eval:corpus", "--", "--strict"]);
  }
  if (hasScript("quickcheck:guard:no-fixture-hardcoding")) {
    runStage("quickcheck:guard:no-fixture-hardcoding", "npm", ["run", "quickcheck:guard:no-fixture-hardcoding"]);
  }

  const port = process.env.PORT || "3000";
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  console.log("\n=== start server ===");
  console.log(`$ npm run start -- -p ${port}`);
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
      if (serverExited) {
        const error = new Error("next start exited before /api/health became ready.");
        error.stage = "start server";
        throw error;
      }
      try {
        console.log(`\n=== health check ===`);
        console.log(`$ GET ${baseUrl}/api/health`);
        await waitForHealth(`${baseUrl}/api/health`, healthTimeoutMs);
        break;
      } catch (error) {
        if (serverExited) {
          const startupError = new Error("next start exited before /api/health became ready.");
          startupError.stage = "start server";
          throw startupError;
        }
        const healthError = error instanceof Error ? error : new Error(String(error));
        healthError.stage = "health check";
        throw healthError;
      }
    }
    runStage(
      "test:audit-pack:smoke",
      "npm",
      ["run", "test:audit-pack:smoke"],
      { ...process.env, BASE_URL: baseUrl },
      `BASE_URL=${baseUrl} npm run test:audit-pack:smoke`,
    );
    runStage(
      "test:audit-pack:trail-smoke",
      "npm",
      ["run", "test:audit-pack:trail-smoke"],
      { ...process.env, BASE_URL: baseUrl },
      `BASE_URL=${baseUrl} npm run test:audit-pack:trail-smoke`,
    );
  } finally {
    if (!serverExited) server.kill("SIGTERM");
    await waitForProcessExit(server, 10000);
  }
}

main().catch((error) => {
  const stage = error?.stage ? ` [${error.stage}]` : "";
  console.error(`\n!!! pr:gate failed${stage}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(error?.exitCode ?? 1);
});
