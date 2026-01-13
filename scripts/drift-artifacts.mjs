import { spawnSync } from "node:child_process";

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "validate:artifacts"]);

const diff = spawnSync("git", ["diff", "--name-only"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

if (diff.status !== 0) {
  process.exit(diff.status ?? 1);
}

const changed = (diff.stdout || "").trim();
if (changed.length > 0) {
  console.error("❌ Artifact drift detected (git diff not empty):");
  console.error(changed);
  process.exit(1);
}

console.log("✅ No artifact drift detected.");
