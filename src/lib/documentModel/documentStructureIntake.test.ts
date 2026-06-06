import { describe, expect, test } from "@jest/globals";
import { buildDocumentStructure } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";

describe("buildDocumentStructure intake classification", () => {
  test("preserves family classification and quality signals on document structure", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Project Description",
        "This Verra VCS Program project description concerns an avoided deforestation activity.",
        "\f",
        "2. Monitoring Plan",
        "The REDD+ AFOLU monitoring plan covers forest conservation and leakage.",
      ].join("\n"),
    });

    const documentStructure = buildDocumentStructure({ parsedDocument });

    expect(documentStructure.documentFamily.family).toBe("VERRA_PD");
    expect(documentStructure.documentFamily.confidence).toBeGreaterThan(0.8);
    expect(documentStructure.documentFamily.signals.some((signal) => signal.family === "REDD_AFOLU")).toBe(true);
    expect(documentStructure.qualityReport.pageCount).toBe(2);
    expect(documentStructure.qualityReport.hasPageBoundaries).toBe(true);
  });

  test("carries UNKNOWN classification and warnings through the document structure", () => {
    const parsedDocument = parseDocumentText({
      rawText: "   ",
    });

    const documentStructure = buildDocumentStructure({ parsedDocument });

    expect(documentStructure.documentFamily.family).toBe("UNKNOWN");
    expect(documentStructure.qualityReport.weakExtractionWarning).toBe(true);
    expect(documentStructure.documentFamily.warnings).toContain(
      "Document family remained UNKNOWN because deterministic intake signals were insufficient.",
    );
  });
});
