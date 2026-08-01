/** @jest-environment jsdom */
import { resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";

function pdfBytes(size: number) { const bytes = new Uint8Array(size); bytes.set(new TextEncoder().encode("%PDF-1.4\n(sample)\n%%EOF")); return bytes.buffer; }
class FakeXhr { upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined }; onload?: () => void; onerror?: () => void; status = 200; open() {} setRequestHeader() {} send() { this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent); this.onload?.(); } }

describe("Quick Check PDF client", () => {
  beforeEach(() => { global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest; });

  it("uploads directly, confirms with only the reference, and preserves server page extraction", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: typeof init?.body === "string" ? init.body : undefined });
      if (String(url).includes("r2-upload") && calls.length === 1) return new Response(JSON.stringify({ uploadRef: "signed-reference", url: "https://r2.example/signed" }));
      if (String(url).includes("r2-upload")) return new Response(JSON.stringify({ uploadRef: "signed-reference", size: 100 }));
      return new Response(JSON.stringify({ pages: [{ pageNumber: 1, text: "Project Description" }], engine: "pdf-parse", metadata: { parser: "pdf-parse" } }));
    }) as typeof fetch;
    const result = await resolveQuickCheckPdfText({ bytes: pdfBytes(100), filename: "project.pdf" });
    expect(result.engine).toBe("pdf-parse");
    expect(result.text).toContain("Project Description");
    expect(JSON.parse(calls[1]!.body!)).toEqual({ action: "confirm", uploadRef: "signed-reference" });
  });

  it("reports the temporary large-file extraction limitation after upload confirmation", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).includes("r2-upload") ? { uploadRef: "signed-reference", url: "https://r2.example/signed", size: 5 * 1024 * 1024 } : {}))) as typeof fetch;
    const result = await resolveQuickCheckPdfText({ bytes: pdfBytes(5 * 1024 * 1024), filename: "large.pdf" });
    expect(result.warning).toContain("server extraction for PDFs over 4 MiB is not available yet");
  });

  it("accepts a 48.95 MiB PDF and completes direct upload before the limitation", async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL) => { urls.push(String(url)); return new Response(JSON.stringify({ uploadRef: "signed-reference", url: "https://r2.example/signed", size: 48_950_000 })); }) as typeof fetch;
    const result = await resolveQuickCheckPdfText({ bytes: pdfBytes(48_950_000), filename: "large-pdd.pdf" });
    expect(urls).toEqual(["/api/quick-check/r2-upload", "/api/quick-check/r2-upload"]);
    expect(result.warning).toContain("server extraction for PDFs over 4 MiB is not available yet");
    expect(result.pdfRef).toBe("signed-reference");
  });

  it("accepts exactly 50 MiB and rejects 50 MiB plus one byte before presign", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ uploadRef: "signed-reference", url: "https://r2.example/signed", size: 50 * 1024 * 1024 }))) as typeof fetch;
    await expect(resolveQuickCheckPdfText({ bytes: pdfBytes(50 * 1024 * 1024), filename: "limit.pdf" })).resolves.toMatchObject({ pdfRef: "signed-reference" });
    await expect(resolveQuickCheckPdfText({ bytes: pdfBytes(50 * 1024 * 1024 + 1), filename: "over-limit.pdf" })).rejects.toThrow("50 MiB");
  });
});
