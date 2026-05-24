import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const extractPdfTextWithPdfParseMock = jest.fn();
const extractPdfTextMock = jest.fn();

jest.mock("@/lib/chat/quickCheckPdfExtractor", () => ({
  extractPdfTextWithPdfParse: (...args: unknown[]) => extractPdfTextWithPdfParseMock(...args),
}));

jest.mock("@/lib/chat/quickCheckEvidence", () => ({
  extractPdfText: (...args: unknown[]) => extractPdfTextMock(...args),
  extractMethodologyMentions: (text: string) => {
    const mentions = new Set<string>();
    for (const match of text.matchAll(/\b(VM\d{4})\b/g)) mentions.add(match[1]);
    for (const match of text.matchAll(/\b(REDD\+\s+Methodology\s+Framework|REDD\+\s+MF)\b/gi)) mentions.add(match[1]);
    for (const match of text.matchAll(/\b(Verra|VCS|CCB)\b/gi)) mentions.add(match[1]);
    return Array.from(mentions);
  },
}));

const { POST } = require("@/app/api/quick-check/pdf-extract/route") as typeof import("@/app/api/quick-check/pdf-extract/route");

describe("/api/quick-check/pdf-extract route", () => {
  beforeEach(() => {
    extractPdfTextWithPdfParseMock.mockReset();
    extractPdfTextMock.mockReset();
  });

  it("supplements parser text when heuristic extraction adds methodology mentions", async () => {
    extractPdfTextWithPdfParseMock.mockResolvedValueOnce({
      text: "Project boundary description for the PLUM project. Verra VCS.",
      engine: "pdf-parse",
      metadata: {
        parser: "pdf-parse",
        diagnostics: {
          parserPath: "bundled-pdf-parse",
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 60,
          pageCount: 1,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: false,
        },
      },
    });
    extractPdfTextMock.mockReturnValueOnce(
      "Project boundary description for the PLUM project. Verra VCS. VM0007. REDD+ Methodology Framework.",
    );

    const req = new Request("http://localhost/api/quick-check/pdf-extract", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array([37, 80, 68, 70]).buffer,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.engine).toBe("pdf-parse");
    expect(body.text).toContain("VM0007");
    expect(body.text).toContain("REDD+ Methodology Framework");
    expect(extractPdfTextMock).toHaveBeenCalledTimes(1);
  });

  it("keeps parser text unchanged when heuristic adds no methodology evidence", async () => {
    extractPdfTextWithPdfParseMock.mockResolvedValueOnce({
      text: "Project boundary description for the PLUM project. VM0007.",
      engine: "pdf-parse",
      metadata: {
        parser: "pdf-parse",
        diagnostics: {
          parserPath: "bundled-pdf-parse",
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 57,
          pageCount: 1,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: false,
        },
      },
    });
    extractPdfTextMock.mockReturnValueOnce(
      "Project boundary description for the PLUM project. VM0007.",
    );

    const req = new Request("http://localhost/api/quick-check/pdf-extract", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array([37, 80, 68, 70]).buffer,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("Project boundary description for the PLUM project. VM0007.");
  });
});
