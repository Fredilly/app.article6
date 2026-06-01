import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

import { POST } from "@/app/api/quick-check/pdf-extract/route";

describe("POST /api/quick-check/pdf-extract", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns extracted text for a small valid pdf upload (raw application/pdf path)", async () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf"));

    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: bytes,
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { text?: string; engine?: string };
    expect(payload.engine === "pdf-parse" || payload.engine === "heuristic").toBe(true);
    expect((payload.text ?? "").trim().length).toBeGreaterThan(0);
  }, 15000);

  it("returns heuristic parser failure metadata when pdf parsing fails but fallback still runs", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: new TextEncoder().encode("%PDF-1.4\n%%%%EOF"),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      text: "",
      engine: "heuristic",
      metadata: {
        parser: "heuristic",
        diagnostics: {
          failureKind: "no-selectable-text",
        },
      },
    });
  }, 10000);

  it("rejects missing pdf bytes with missing-file code", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: new Uint8Array(0),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing PDF bytes.",
      code: "missing-file",
    });
  });

  it("rejects invalid non-pdf uploads (content-type) with invalid-file code", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: new TextEncoder().encode("not a pdf"),
      }),
    );

    expect(response.status).toBe(415);
    const payload = await response.json();
    expect(payload).toMatchObject({ code: "invalid-file" });
    expect(payload.error).toContain("must be a PDF");
  });

  it("rejects uploads with invalid PDF magic bytes with invalid-file code", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: new TextEncoder().encode("NOTPDF junk bytes here"),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toMatchObject({ code: "invalid-file" });
    expect(payload.error).toContain("not a valid PDF");
  });

  it("rejects oversized PDF with file-too-large code", async () => {
    const oversized = new Uint8Array(21 * 1024 * 1024); // > 20MB
    // make it look like PDF to pass magic check
    const header = new TextEncoder().encode("%PDF-1.4\n");
    oversized.set(header, 0);

    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: oversized,
      }),
    );

    expect(response.status).toBe(413);
    const payload = await response.json();
    expect(payload).toMatchObject({ code: "file-too-large" });
    expect(payload.error).toContain("exceeds the Quick Check upload limit");
  }, 30000);

  it("accepts a valid PDF via multipart/form-data (browser-style FormData upload path)", async () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf"));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "application/pdf" }), "test.pdf");
    form.append("filename", "test.pdf");

    const response = await POST(
      new NextRequest("http://localhost/api/quick-check/pdf-extract", {
        method: "POST",
        body: form as any, // NextRequest accepts FormData in test env
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { text?: string; engine?: string };
    expect((payload.text ?? "").trim().length).toBeGreaterThan(0);
    expect(payload.engine === "pdf-parse" || payload.engine === "heuristic").toBe(true);
  }, 15000);
});
