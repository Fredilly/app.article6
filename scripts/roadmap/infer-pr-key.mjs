#!/usr/bin/env node

export function inferPrKey({ title, body, branch } = {}) {
  const titleText = String(title ?? "");
  const bodyText = String(body ?? "");
  const branchText = String(branch ?? "");

  const titleMatchers = [
    /\bpr\s*\(?\s*(\d+)\s*\)?\b/i,
    /\bfeat\(pr(\d+)\)\b/i,
  ];

  for (const matcher of titleMatchers) {
    const match = titleText.match(matcher);
    if (match?.[1]) return `PR${match[1]}`;
  }

  const bodyMatch = bodyText.match(/\bpr\s*\(?\s*(\d+)\s*\)?\b/i);
  if (bodyMatch?.[1]) return `PR${bodyMatch[1]}`;

  const branchMatch = branchText.match(/\bpr(\d+)\b/i);
  if (branchMatch?.[1]) return `PR${branchMatch[1]}`;

  return null;
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const title = getArg("--title");
  const body = getArg("--body");
  const branch = getArg("--branch");
  const output = getArg("--output");
  const prKey = inferPrKey({ title, body, branch });

  if (output) {
    const fs = await import("node:fs");
    fs.appendFileSync(output, `prKey=${prKey ?? ""}\n`, "utf8");
  }

  if (prKey) {
    console.log(prKey);
    process.exit(0);
  }

  process.exit(1);
}
