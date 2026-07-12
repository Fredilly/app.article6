const fs = require("node:fs");

function normalizeChangedFiles(changedFiles) {
  return changedFiles
    .map((file) => String(file ?? "").trim().replace(/\\/g, "/"))
    .filter((file) => file.length > 0);
}

function classifyChangedFiles(changedFiles) {
  const files = normalizeChangedFiles(changedFiles);
  const docsOnly = files.length > 0 && files.every((file) => file.startsWith("docs/"));
  return {
    files,
    mode: docsOnly ? "docs-only" : "full",
  };
}

function parseChangedFilesFromText(input) {
  return String(input ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatSelectionLabel(mode) {
  return mode === "docs-only" ? "docs-only fast gate" : "full gate";
}

function formatScopeDecision(result) {
  const fileLines = result.files.length ? result.files.map((file) => `- ${file}`) : ["- (no changed files)"];
  return ["Changed files:", ...fileLines, `Selected: ${formatSelectionLabel(result.mode)}`].join("\n");
}

function main() {
  const args = process.argv.slice(2);
  let modeOnly = false;
  let printOnly = false;
  for (const arg of args) {
    if (arg === "--mode") {
      modeOnly = true;
      continue;
    }
    if (arg === "--print") {
      printOnly = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const input = fs.readFileSync(0, "utf8");
  const result = classifyChangedFiles(parseChangedFilesFromText(input));

  if (printOnly) {
    process.stdout.write(`${formatScopeDecision(result)}\n`);
    return;
  }

  if (modeOnly) {
    process.stdout.write(result.mode);
    return;
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  classifyChangedFiles,
  formatScopeDecision,
  formatSelectionLabel,
  normalizeChangedFiles,
  parseChangedFilesFromText,
};
