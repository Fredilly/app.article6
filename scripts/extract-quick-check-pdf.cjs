#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const pdfPath = process.argv[2];
  const includePages = process.argv.includes("--pages");
  if (!pdfPath) {
    throw new Error("Missing PDF path.");
  }

  const absolutePath = path.resolve(pdfPath);
  const bytes = fs.readFileSync(absolutePath);
  const mod = requireFromProject("pdf-parse");
  const parser = new mod.PDFParse({
    data: new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  try {
    const result = await parser.getText();
    process.stdout.write(JSON.stringify({
      text: normalizeWhitespace(result.text ?? ""),
      pages: includePages
        ? (Array.isArray(result.pages)
          ? result.pages.map((page, index) => ({
            pageNumber: typeof page.num === "number" ? page.num : index + 1,
            text: String(page.text ?? "").replace(/\r\n?/g, "\n").trim(),
          }))
          : [])
        : undefined,
    }));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
