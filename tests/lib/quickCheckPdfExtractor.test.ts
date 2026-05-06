import fs from "fs";
import path from "path";
import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { extractPdfPagesWithPdfParse, extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";

describe("quick check pdf-parse extractor", () => {
  const getTextMock = jest.fn<() => Promise<{ text?: string }>>();
  const destroyMock = jest.fn<() => Promise<void>>();
  const PdfParseClassMock = jest.fn().mockImplementation(() => ({
    getText: getTextMock,
    destroy: destroyMock,
  }));

  beforeEach(() => {
    PdfParseClassMock.mockClear();
    getTextMock.mockReset();
    destroyMock.mockReset();
    destroyMock.mockResolvedValue();
  });

  it("reads text emitted by pdf-parse", async () => {
    getTextMock.mockResolvedValue({ text: "Project area  Lilongwe District" });

    const result = await extractPdfTextWithPdfParse({
      bytes: new TextEncoder().encode("%PDF-test").buffer,
      PdfParseClass: PdfParseClassMock as never,
    });

    expect(result.text).toBe("Project area Lilongwe District");
    expect(result.metadata).toEqual({
      parser: "pdf-parse",
    });
    expect(destroyMock).toHaveBeenCalled();
  });

  it("normalizes empty-ish text from pdf-parse", async () => {
    getTextMock.mockResolvedValue({ text: "  Monitoring report covers the reporting period.  " });

    const result = await extractPdfTextWithPdfParse({
      bytes: new TextEncoder().encode("%PDF-json").buffer,
      PdfParseClass: PdfParseClassMock as never,
    });

    expect(result.text).toContain("Monitoring report covers the reporting period.");
    expect(result.metadata).toEqual({
      parser: "pdf-parse",
    });
  });

  it("propagates parser failures so the route can fall back", async () => {
    getTextMock.mockRejectedValue(new Error("broken pdf"));

    await expect(
      extractPdfTextWithPdfParse({
        bytes: new TextEncoder().encode("%PDF-missing-java").buffer,
        PdfParseClass: PdfParseClassMock as never,
      }),
    ).rejects.toThrow("broken pdf");
  });

  it("extracts the strong-signal Malawi fixture through the real helper-backed parser path", async () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/quick-check/malawi-strong-signal-evidence.pdf");
    const bytes = fs.readFileSync(fixturePath);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const result = await extractPdfTextWithPdfParse({
      bytes: arrayBuffer,
    });

    expect(result.engine).toBe("pdf-parse");
    expect(result.text).toContain("Gold Standard TPDDTEC, Version 4.0");
    expect(result.text).toContain("The monitoring report covers the full reporting period");
  }, 15000);

  it("returns per-page text when page extraction is requested", async () => {
    getTextMock.mockResolvedValue({
      text: "Page one text Page two text",
      pages: [
        { num: 1, text: "Page one text" },
        { num: 2, text: "Page two text" },
      ],
    });

    const result = await extractPdfPagesWithPdfParse({
      bytes: new TextEncoder().encode("%PDF-pages").buffer,
      PdfParseClass: PdfParseClassMock as never,
    });

    expect(result.pages).toEqual([
      { pageNumber: 1, text: "Page one text" },
      { pageNumber: 2, text: "Page two text" },
    ]);
    expect(result.text).toBe("Page one text Page two text");
  });

  it("falls back to a synthetic page when only full-document text is available", async () => {
    getTextMock.mockResolvedValue({
      text: "Appendix 1\nF-001\nDescription: Missing annex reference.",
    });

    const result = await extractPdfPagesWithPdfParse({
      bytes: new TextEncoder().encode("%PDF-text-only").buffer,
      PdfParseClass: PdfParseClassMock as never,
    });

    expect(result.pages).toEqual([
      {
        pageNumber: 1,
        text: "Appendix 1\nF-001\nDescription: Missing annex reference.",
      },
    ]);
    expect(result.text).toContain("F-001");
  });

  it("throws when neither page extraction nor text extraction yields extractable text", async () => {
    getTextMock.mockResolvedValue({ text: "   ", pages: [] });

    await expect(
      extractPdfPagesWithPdfParse({
        bytes: new TextEncoder().encode("%PDF-image-only").buffer,
        PdfParseClass: PdfParseClassMock as never,
      }),
    ).rejects.toThrow("No extractable text found in PDF.");
  });

  it("falls back to helper text extraction when helper page extraction fails", async () => {
    const result = await extractPdfPagesWithPdfParse({
      bytes: new TextEncoder().encode("%PDF-helper-fallback").buffer,
      helperOverrides: {
        extractPagesViaHelper: async () => {
          throw new Error("stdout maxBuffer length exceeded");
        },
        extractTextViaHelper: async () => ({
          text: "Appendix 1\nF-001\nDescription: Missing annex reference.\nProject response: Submitted revised annex.",
        }),
      },
    });

    expect(result.pages).toEqual([
      {
        pageNumber: 1,
        text: "Appendix 1\nF-001\nDescription: Missing annex reference.\nProject response: Submitted revised annex.",
      },
    ]);
    expect(result.text).toContain("Project response");
  });
});
