/** @jest-environment jsdom */

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";

const RECOVERED_WARNING =
  "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.";

/**
 * Build a PDF-like ArrayBuffer of the given byte length.
 */
function makePdfBytes(size: number, text?: string): ArrayBuffer {
  const content = text ?? "%PDF-1.4\n(sample text for extraction)\n%%EOF";
  const encoded = new TextEncoder().encode(content);
  if (encoded.length >= size) return encoded.buffer as ArrayBuffer;
  const buf = new Uint8Array(size);
  buf.set(encoded);
  return buf.buffer as ArrayBuffer;
}

// Track which route resolveQuickCheckPdfText hit
let lastFetchUrl = "";

// Mock the @vercel/blob/client upload via jest.mock at top level
const mockUpload = jest.fn() as jest.Mock;
jest.mock("@vercel/blob/client", () => ({ upload: mockUpload }), { virtual: true });

describe("quick check pdf client", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = undefined as unknown as typeof fetch;
    lastFetchUrl = "";
    mockUpload.mockReset();
  });

  it("preserves heuristic fallback details returned by the extraction route", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          text: "Recovered fallback text",
          engine: "heuristic",
          metadata: {
            parser: "heuristic",
            fallbackReason: "broken pdf",
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: new TextEncoder().encode("%PDF-test").buffer,
      filename: "fallback.pdf",
    });

    expect(result).toEqual({
      text: "Recovered fallback text",
      engine: "heuristic",
      methodologyMentions: [],
      warning: RECOVERED_WARNING,
    });
  });

  it("falls back locally when the extraction route request fails", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: new TextEncoder().encode("%PDF-1.4\n(Monitoring report)\n%%EOF").buffer,
      filename: "offline.pdf",
    });

    expect(result.engine).toBe("heuristic");
    expect(result.text).toContain("Monitoring report");
    expect(result.methodologyMentions).toEqual([]);
    expect(result.warning).toBe(RECOVERED_WARNING);
    expect(result.diagnosticCode).toBe("upload-request-failed");
  });

  it("surfaces no-selectable-text as a distinct diagnostic", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          text: "",
          engine: "heuristic",
          metadata: {
            parser: "heuristic",
            fallbackReason: "pdf-parse returned empty text",
            diagnostics: {
              failureKind: "no-selectable-text",
            },
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: new TextEncoder().encode("%PDF-empty").buffer,
      filename: "image-only.pdf",
    });

    expect(result.warning).toBe("No selectable text found in this PDF.");
    expect(result.diagnosticCode).toBe("no-selectable-text");
  });

  it("recovers text from the heuristic fallback path for small files", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          text: "",
          engine: "heuristic",
          metadata: {
            parser: "heuristic",
            fallbackReason: "broken pdf",
            diagnostics: {
              failureKind: "parser-failed",
            },
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: new TextEncoder().encode("%PDF-1.4\n(VM0007 REDD+ Methodology Framework)\n%%EOF").buffer,
      filename: "plum.pdf",
    });

    expect(result.engine).toBe("heuristic");
    expect(result.text).toContain("VM0007");
    expect(result.methodologyMentions).toEqual(
      expect.arrayContaining(["VM0007", "REDD+ Methodology Framework"]),
    );
    expect(result.warning).toBe(RECOVERED_WARNING);
  });

  // ---------------------------------------------------------------------------
  // Direct Blob upload path (files >4MB)
  // ---------------------------------------------------------------------------

  it("uses direct Blob upload for files larger than 4MB and returns a blob pdfRef", async () => {
    mockUpload.mockResolvedValue({
      url: "https://mock.private.blob.vercel-storage.com/quick-check/pdfs/large.pdf",
      pathname: "quick-check/pdfs/large.pdf",
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="large.pdf"',
      size: 5 * 1024 * 1024,
    });

    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      lastFetchUrl = typeof url === "string" ? url : url.toString();
      return new Response(
        JSON.stringify({
          text: "Extracted text from large PDD with detailed methodology sections.",
          engine: "pdf-parse",
          pdfRef: "https://mock.private.blob.vercel-storage.com/quick-check/pdfs/large.pdf",
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: makePdfBytes(5 * 1024 * 1024 + 100),
      filename: "large-pdd.pdf",
    });

    expect(result.text).toContain("Extracted text");
    expect(result.pdfRef).toContain("private.blob.vercel-storage.com");
    expect(result.engine).toBe("pdf-parse");
  });

  it("falls back to local heuristic when direct Blob upload fails (server unreachable)", async () => {
    mockUpload.mockRejectedValue(new Error("Blob upload failed"));

    const result = await resolveQuickCheckPdfText({
      bytes: makePdfBytes(5 * 1024 * 1024 + 100, "%PDF-1.4\n(VM0007 REDD+)\n%%EOF"),
      filename: "failing-upload.pdf",
    });

    expect(result.engine).toBe("heuristic");
    expect(result.text).toContain("VM0007");
    expect(result.diagnosticCode).toBe("upload-request-failed");
  });

  it("still uses FormData path for files ≤4MB", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      lastFetchUrl = typeof url === "string" ? url : url.toString();
      return new Response(
        JSON.stringify({
          text: "Small file text",
          engine: "pdf-parse",
          pdfRef: "legacy-token",
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await resolveQuickCheckPdfText({
      bytes: makePdfBytes(3 * 1024 * 1024),
      filename: "small.pdf",
    });

    expect(lastFetchUrl).toContain("/api/quick-check/pdf-extract");
    expect(result.text).toBe("Small file text");
    expect(result.pdfRef).toBe("legacy-token");
  });
});
