import fs from "fs";
import path from "path";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { POST as postUpload } from "@/app/api/quick-check/r2-upload/route";
import { POST as postExtract } from "@/app/api/quick-check/pdf-extract/route";
import { resolveStructuredQueryContext } from "@/lib/chat/quickCheckStructuredQuery";
import { resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";

describe("Quick Check private R2 orchestration", () => {
  it("performs one upload, retrieval, extraction, and Evidence Map build", async () => {
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://preview.article6.example";

    const bytes = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf"));
    let presignCount = 0;
    let putCount = 0;
    let confirmationCount = 0;
    let getObjectCount = 0;
    let extractionCount = 0;
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof GetObjectCommand) {
        getObjectCount += 1;
        return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      }
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      throw new Error("unexpected R2 command");
    });

    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl === "/api/quick-check/r2-upload") {
        const body = typeof init?.body === "string" ? init.body : "{}";
        const action = JSON.parse(body).action;
        if (action === "presign") presignCount += 1;
        if (action === "confirm") confirmationCount += 1;
        return postUpload(new NextRequest(`https://preview.article6.example${requestUrl}`, {
          method: "POST",
          headers: { origin: "https://preview.article6.example", "content-type": "application/json" },
          body,
        }));
      }
      if (requestUrl === "/api/quick-check/pdf-extract") {
        extractionCount += 1;
        return postExtract(new NextRequest(`https://preview.article6.example${requestUrl}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: init?.body,
        }));
      }
      throw new Error(`unexpected browser request: ${requestUrl}`);
    }) as typeof fetch;

    class MockUploadXhr {
      upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined };
      onload?: () => void;
      onerror?: () => void;
      status = 200;
      open() {}
      setRequestHeader() {}
      send() {
        putCount += 1;
        this.upload.onprogress?.({ lengthComputable: true, loaded: bytes.length, total: bytes.length } as ProgressEvent);
        this.onload?.();
      }
    }
    global.XMLHttpRequest = MockUploadXhr as unknown as typeof XMLHttpRequest;

    const extracted = await resolveQuickCheckPdfText({ bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), filename: "project.pdf" });
    expect(extracted.text).toContain("Project");
    expect(extracted.parsedDocument).toBeDefined();

    const context = await resolveStructuredQueryContext(extracted.text, extracted.pdfRef, extracted.parsedDocument);
    expect(context.evidenceDocument).toBeDefined();
    expect({ presignCount, putCount, confirmationCount, getObjectCount, extractionCount }).toEqual({
      presignCount: 1,
      putCount: 1,
      confirmationCount: 1,
      getObjectCount: 1,
      extractionCount: 1,
    });
  }, 30000);
});
