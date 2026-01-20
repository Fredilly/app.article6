#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { listSsotFiles } from "./roadmap-lib.mjs";

export function findSsotForPr(prKey, ssotRoot = path.join("docs", "roadmaps")) {
  if (!prKey) throw new Error("missing pr key");
  const target = prKey.toUpperCase();
  const ssotFiles = listSsotFiles(ssotRoot);
  const matches = [];

  for (const ssotPath of ssotFiles) {
    const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
    const keys = Object.keys(ssot).map((key) => key.toUpperCase());
    if (keys.includes(target)) {
      const slug = path.basename(path.dirname(ssotPath));
      matches.push({ ssotPath, slug });
    }
  }

  if (!matches.length) {
    const error = new Error(`not in SSOT: ${target}`);
    error.code = "NOT_FOUND";
    throw error;
  }

  if (matches.length > 1) {
    const error = new Error(`ambiguous SSOT for ${target}`);
    error.code = "AMBIGUOUS";
    error.matches = matches;
    throw error;
  }

  return matches[0];
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pr = getArg("--pr");
  const output = getArg("--output");
  const allowMissing = process.argv.includes("--allow-missing");

  try {
    const result = findSsotForPr(pr);
    if (output) {
      fs.appendFileSync(output, `ssotPath=${result.ssotPath}\nslug=${result.slug}\n`, "utf8");
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    if (allowMissing) {
      if (output) {
        fs.appendFileSync(output, "ssotPath=\nslug=\n", "utf8");
      }
      process.exit(0);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
