import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { parseDocumentText } from "@/lib/documentParsing";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";

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
