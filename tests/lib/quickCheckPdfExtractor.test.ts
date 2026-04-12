import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";

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
});
