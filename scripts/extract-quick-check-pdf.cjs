#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

function ensureNodePdfGlobals() {
  if (typeof global.DOMMatrix === "function" && typeof global.ImageData === "function") {
    return;
  }
  const canvas = requireFromProject("@napi-rs/canvas");
  if (typeof global.DOMMatrix !== "function" && typeof canvas.DOMMatrix === "function") {
    global.DOMMatrix = canvas.DOMMatrix;
  }
  if (typeof global.ImageData !== "function" && typeof canvas.ImageData === "function") {
    global.ImageData = canvas.ImageData;
  }
  if (typeof global.Path2D !== "function" && typeof canvas.Path2D === "function") {
    global.Path2D = canvas.Path2D;
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const pdfPath = process.argv[2];
  const includePages = process.argv.includes("--pages");
  if (!pdfPath) {
    throw new Error("Missing PDF path.");
  }

  const absolutePath = path.resolve(pdfPath);
  const bytes = fs.readFileSync(absolutePath);
  ensureNodePdfGlobals();
  const mod = requireFromProject("pdf-parse");
  const parser = new mod.PDFParse({
    data: new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  try {
    const result = await parser.getText();
    process.stdout.write(JSON.stringify({
      text: normalizeText(result.text ?? ""),
      pages: includePages
        ? (Array.isArray(result.pages)
          ? result.pages.map((page, index) => ({
            pageNumber: typeof page.num === "number" ? page.num : index + 1,
            text: normalizeText(page.text ?? ""),
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
