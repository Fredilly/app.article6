/** @jest-environment jsdom */
import { clearQuickCheckUploadCache, resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";

function pdfBytes(size: number) { const bytes = new Uint8Array(size); bytes.set(new TextEncoder().encode("%PDF-1.4\n(sample)\n%%EOF")); return bytes.buffer; }
class FakeXhr { upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined }; onload?: () => void; onerror?: () => void; status = 200; open() {} setRequestHeader() {} send() { this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent); this.onload?.(); } }

describe("Quick Check PDF client", () => {
  beforeEach(() => { clearQuickCheckUploadCache(); global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest; });

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

  it("retrieves and extracts a large PDF through the signed reference", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).includes("r2-upload") ? { uploadRef: "signed-reference", url: "https://r2.example/signed", size: 5 * 1024 * 1024 } : { pages: [{ pageNumber: 1, text: "Large project description" }], engine: "pdf-parse", metadata: { parser: "pdf-parse" } }))) as typeof fetch;
    const result = await resolveQuickCheckPdfText({ bytes: pdfBytes(5 * 1024 * 1024), filename: "large.pdf" });
    expect(result.text).toContain("Large project description");
    const extractionCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes("pdf-extract"));
    expect(JSON.parse(extractionCall[1].body)).toEqual({ uploadRef: "signed-reference" });
  });

  it("accepts a 48.95 MiB PDF and completes direct upload and extraction", async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL) => { urls.push(String(url)); return new Response(JSON.stringify(String(url).includes("r2-upload") ? { uploadRef: "signed-reference", url: "https://r2.example/signed", size: 48_950_000 } : { text: "extracted content", engine: "pdf-parse" })); }) as typeof fetch;
    const result = await resolveQuickCheckPdfText({ bytes: pdfBytes(48_950_000), filename: "large-pdd.pdf" });
    expect(urls).toEqual(["/api/quick-check/r2-upload", "/api/quick-check/r2-upload"]);
    expect(result.pdfRef).toBe("signed-reference");
    expect(result.text).toContain("extracted content");
    expect(urls).toEqual(["/api/quick-check/r2-upload", "/api/quick-check/r2-upload", "/api/quick-check/pdf-extract"]);
  });

  it("accepts exactly 50 MiB and rejects 50 MiB plus one byte before presign", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ uploadRef: "signed-reference", url: "https://r2.example/signed", size: 50 * 1024 * 1024 }))) as typeof fetch;
    await expect(resolveQuickCheckPdfText({ bytes: pdfBytes(50 * 1024 * 1024), filename: "limit.pdf" })).resolves.toMatchObject({ pdfRef: "signed-reference" });
    await expect(resolveQuickCheckPdfText({ bytes: pdfBytes(50 * 1024 * 1024 + 1), filename: "over-limit.pdf" })).rejects.toThrow("50 MiB");
  });

  it("shares concurrent uploads and reuses the confirmed reference by SHA-256", async () => {
    let presigns = 0;
    let confirmations = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("r2-upload")) {
        if (presigns === confirmations) { presigns += 1; return new Response(JSON.stringify({ uploadRef: "shared-reference", url: "https://r2.example/signed" })); }
        confirmations += 1;
        return new Response(JSON.stringify({ uploadRef: "shared-reference", size: 100 }));
      }
      return new Response(JSON.stringify({ text: "same extracted text", engine: "pdf-parse", metadata: { parser: "pdf-parse" } }));
    }) as typeof fetch;
    const input = { attachmentId: "attachment-1", sha256: "sha-same", bytes: pdfBytes(100), filename: "same.pdf" };
    const [first, second] = await Promise.all([resolveQuickCheckPdfText(input), resolveQuickCheckPdfText(input)]);
    await resolveQuickCheckPdfText({ ...input, filename: "renamed.pdf" });
    expect(first.pdfRef).toBe("shared-reference");
    expect(second.pdfRef).toBe("shared-reference");
    expect(presigns).toBe(1);
    expect(confirmations).toBe(1);
  });

  it("removes a failed cache entry so a later retry can upload", async () => {
    let attempts = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("r2-upload")) {
        attempts += 1;
        if (attempts === 1) return new Response(JSON.stringify({ error: "temporary failure" }), { status: 503 });
        return new Response(JSON.stringify({ uploadRef: "retry-reference", url: "https://r2.example/signed" }));
      }
      return new Response(JSON.stringify({ text: "retry text", engine: "pdf-parse", metadata: { parser: "pdf-parse" } }));
    }) as typeof fetch;
    const input = { attachmentId: "attachment-retry", sha256: "sha-retry", bytes: pdfBytes(100), filename: "retry.pdf" };
    await expect(resolveQuickCheckPdfText(input)).rejects.toThrow("temporary failure");
    await expect(resolveQuickCheckPdfText(input)).resolves.toMatchObject({ pdfRef: "retry-reference" });
    expect(attempts).toBe(3);
  });
});
