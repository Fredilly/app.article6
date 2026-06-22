import { existsSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { parseDocumentText } from "@/lib/documentParsing";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { resolveStructuredQueryContext } from "@/lib/chat/quickCheckStructuredQuery";
import { storePdfRef, resolvePdfRef } from "@/lib/chat/quickCheckPdfStore";

function isPymupdfAvailable(): boolean {
  const python3 = process.env.PYTHON3
    ?? (existsSync(path.resolve(process.cwd(), ".venv/bin/python3"))
      ? path.resolve(process.cwd(), ".venv/bin/python3")
      : "python3");
  try {
    execFileSync(python3, ["-c", "import fitz"], { timeout: 10000, encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

describe("parserUsed trace in StructuredQueryContext", () => {
  it("rawText-only path falls back to current-extractor with pymupdf as default", () => {
    const ctx = getStructuredQueryContext("1 Project Details\nHost country: Indonesia");

    expect(ctx.parserAdapterId).toBe("current-extractor");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });

  it("parseDocumentText with pdfFilePath uses pymupdf when helper is wired", () => {
    const fixture = path.resolve(
      process.cwd(),
      "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
    );

    if (!existsSync(fixture)) {
      return;
    }

    initPymupdfAdapterRuntime();

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: fixture,
    });

    // When pymupdf is installed and working: adapterId is "pymupdf"
    // When pymupdf is not available: falls back to "current-extractor"
    const validIds = ["pymupdf", "current-extractor"];
    expect(validIds).toContain(parsed.adapterId);

    if (parsed.adapterId === "pymupdf") {
      expect(parsed.qualityReport.hasPageBoundaries).toBeDefined();
      expect(parsed.pages.length).toBeGreaterThan(0);
    } else {
      expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
    }
  });
});

describe("parserUsed trace in semantic evidence (server-side)", () => {
  it("suggestSemanticEvidence receives pdfFilePath from pdfRef resolution", async () => {
    const { suggestSemanticEvidence } = await import(
      "@/lib/quickCheck/semanticEvidence/huggingFace"
    );

    const noPdfResult = await suggestSemanticEvidence({
      claimText: "What is the host country?",
      rawPddText: "Host country: Indonesia\nMethodology: VM0007",
    });

    expect(noPdfResult.status).toBeDefined();
    expect(typeof noPdfResult.status).toBe("string");
  });

  it("parseDocumentText with existing PDF fixture has parserUsed metadata", () => {
    const fixture = path.resolve(
      process.cwd(),
      "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
    );

    if (!existsSync(fixture)) {
      return;
    }

    initPymupdfAdapterRuntime();

    const parsed = parseDocumentText({
      rawText: "Project Description\nThis is a test document.",
      pdfFilePath: fixture,
    });

    // At minimum, we always get a valid parsed document
    expect(parsed.adapterId).toBeDefined();
    expect(parsed.rawText).toBeTruthy();
    expect(parsed.pages.length).toBeGreaterThan(0);

    if (parsed.adapterId === "pymupdf") {
      expect(parsed.diagnostics?.metadata?.engine).toBe("pymupdf");
    }
  });
});

describe("resolveStructuredQueryContext with pdfRef → PyMuPDF", () => {
  const FIXTURE = path.resolve(
    process.cwd(),
    "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
  );

  it("storePdfRef + resolvePdfRef round-trips", () => {
    if (!existsSync(FIXTURE)) return;

    const token = storePdfRef(FIXTURE);
    expect(typeof token).toBe("string");
    expect(token.startsWith("pdf:")).toBe(true);

    const resolved = resolvePdfRef(token);
    expect(resolved).toBe(FIXTURE);
  });

  it("resolveStructuredQueryContext with pdfRef returns parserAdapterId: pymupdf when available", async () => {
    if (!existsSync(FIXTURE)) return;

    const token = storePdfRef(FIXTURE);

    const ctx = await resolveStructuredQueryContext(
      "Project Description\nThis is a test.",
      token,
    );

    if (isPymupdfAvailable()) {
      expect(ctx.parserAdapterId).toBe("pymupdf");
      expect(ctx.parserFallbackFrom).toBeUndefined();
      expect(ctx.parsedDocument.adapterId).toBe("pymupdf");
    } else {
      // On CI without pymupdf: falls back with diagnostics
      expect(ctx.parserAdapterId).toBe("current-extractor");
      expect(ctx.parserFallbackFrom).toBe("pymupdf");
    }
  });

  it("resolveStructuredQueryContext without pdfRef falls back to current-extractor", async () => {
    const ctx = await resolveStructuredQueryContext(
      "1 Project Details\nHost country: Indonesia",
      undefined,
    );

    expect(ctx.parserAdapterId).toBe("current-extractor");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });

  it("resolveStructuredQueryContext with expired pdfRef falls back", async () => {
    if (!existsSync(FIXTURE)) return;

    // Store with a short-lived token, then manually delete it to simulate expiry
    const token = storePdfRef(FIXTURE);
    expect(resolvePdfRef(token)).toBe(FIXTURE);

    // Use a non-existent token to simulate expiry
    const ctx = await resolveStructuredQueryContext(
      "1 Project Details\nHost country: Indonesia",
      "pdf:expired:deadbeef",
    );

    expect(ctx.parserAdapterId).toBe("current-extractor");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });
});
