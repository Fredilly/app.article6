#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePageWhitespace(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let pdfJsGlobalsReady = false;

async function ensurePdfJsNodeGlobals() {
  if (pdfJsGlobalsReady) return;
  pdfJsGlobalsReady = true;

  try {
    const canvasModule = requireFromProject("@napi-rs/canvas");
    if (typeof globalThis.DOMMatrix === "undefined" && typeof canvasModule.DOMMatrix !== "undefined") {
      globalThis.DOMMatrix = canvasModule.DOMMatrix;
    }
    if (typeof globalThis.ImageData === "undefined" && typeof canvasModule.ImageData !== "undefined") {
      globalThis.ImageData = canvasModule.ImageData;
    }
    if (typeof globalThis.Path2D === "undefined" && typeof canvasModule.Path2D !== "undefined") {
      globalThis.Path2D = canvasModule.Path2D;
    }
  } catch {
    // Keep helper failures truthful if the optional canvas runtime is unavailable.
  }
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    throw new Error("Missing PDF path.");
  }
  const includePages = process.argv.includes("--pages");

  const absolutePath = path.resolve(pdfPath);
  const bytes = fs.readFileSync(absolutePath);
  await ensurePdfJsNodeGlobals();
  const mod = requireFromProject("pdf-parse");
  const parser = new mod.PDFParse({
    data: new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  try {
    const result = await parser.getText();
    const payload = { text: normalizeWhitespace(result.text ?? "") };
    if (includePages) {
      payload.pages = Array.isArray(result.pages)
        ? result.pages.map((page, index) => ({
          pageNumber: typeof page?.num === "number" ? page.num : index + 1,
          text: normalizePageWhitespace(page?.text ?? ""),
        })).filter((page) => page.text)
        : [];
    }
    process.stdout.write(JSON.stringify(payload));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
