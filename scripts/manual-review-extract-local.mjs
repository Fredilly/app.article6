import fs from "fs";
import path from "path";

async function main() {
  const pdfPath = process.argv[2];
  const endpoint = process.argv[3] ?? "http://127.0.0.1:3000/api/projects/manual-review/extract-findings";

  if (!pdfPath) {
    throw new Error("Usage: node scripts/manual-review-extract-local.mjs <pdf-path> [route-url]");
  }

  const absolutePath = path.resolve(pdfPath);
  const bytes = fs.readFileSync(absolutePath);
  const fileName = path.basename(absolutePath);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "x-article6-filename": fileName,
    },
    body: bytes,
  });

  const payload = await response.json();
  const drafts = Array.isArray(payload.drafts) ? payload.drafts : [];

  process.stdout.write(JSON.stringify({
    status: response.status,
    traceLabel: payload.traceLabel,
    message: payload.message,
    extractionFailed: payload.extractionFailed,
    diagnosticSummary: payload.diagnosticSummary,
    draftCount: drafts.length,
    draftIds: drafts.map((draft) => draft.findingId),
    hasCAR01: drafts.some((draft) => draft.findingId === "CAR01"),
    hasCL01: drafts.some((draft) => draft.findingId === "CL01"),
    hasFAR01: drafts.some((draft) => draft.findingId === "FAR01"),
    containsDomMatrixError: JSON.stringify(payload).includes("DOMMatrix is not defined"),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
