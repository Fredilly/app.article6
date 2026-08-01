import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

import { POST } from "@/app/api/quick-check/pdf-extract/route";
import { issueUploadReference } from "@/lib/quickCheck/r2Upload";

describe("POST /api/quick-check/pdf-extract", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
  });

  it("retrieves a confirmed private-R2 PDF and sends its bytes to the existing extractor", async () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf"));
    const reference = issueUploadReference(bytes.length);
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      throw new Error("unexpected command");
    });
    const response = await POST(new NextRequest("http://localhost/api/quick-check/pdf-extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadRef: reference, objectKey: "client-controlled-key" }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.pdfRef).toBe(reference);
    expect(payload.text).toContain("Project");
  }, 15000);

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
    const payload = (await response.json()) as {
      text?: string;
      engine?: string;
      pages?: Array<{ pageNumber: number; text: string }>;
    };
    expect(payload.engine === "pdf-parse" || payload.engine === "heuristic").toBe(true);
    expect((payload.text ?? "").trim().length).toBeGreaterThan(0);
    if (payload.engine === "pdf-parse") {
      expect(payload.pages?.length).toBeGreaterThan(0);
      expect(payload.text).toMatch(/^Page 1\b/m);
    }
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
          failureKind: "parser-failed",
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
    const oversized = new Uint8Array((50 * 1024 * 1024) + 1); // > 50 MiB
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
    const payload = (await response.json()) as {
      text?: string;
      engine?: string;
      pages?: Array<{ pageNumber: number; text: string }>;
    };
    expect((payload.text ?? "").trim().length).toBeGreaterThan(0);
    expect(payload.engine === "pdf-parse" || payload.engine === "heuristic").toBe(true);
    if (payload.engine === "pdf-parse") {
      expect(payload.pages?.length).toBeGreaterThan(0);
      expect(payload.text).toMatch(/^Page 1\b/m);
    }
  }, 15000);
});
