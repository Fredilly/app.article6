/** @jest-environment jsdom */

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";

describe("quick check pdf client", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
      warning: "PDF parser fallback: broken pdf",
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
    expect(result.warning).toContain("client request failed");
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

  it("recovers local text when the server extractor returns an empty failure payload", async () => {
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
  });

});
