#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    throw new Error("Missing PDF path.");
  }

  const absolutePath = path.resolve(pdfPath);
  const bytes = fs.readFileSync(absolutePath);
  const mod = require("../node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs");
  const parser = new mod.PDFParse({
    data: new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  try {
    const result = await parser.getText();
    process.stdout.write(JSON.stringify({ text: normalizeWhitespace(result.text ?? "") }));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
