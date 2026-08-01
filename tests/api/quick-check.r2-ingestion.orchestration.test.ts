import fs from "fs";
import path from "path";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { POST as postUpload } from "@/app/api/quick-check/r2-upload/route";
import { POST as postExtract } from "@/app/api/quick-check/pdf-extract/route";
import { resolveStructuredQueryContext } from "@/lib/chat/quickCheckStructuredQuery";

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

    const presign = await postUpload(new NextRequest("https://preview.article6.example/api/quick-check/r2-upload", {
      method: "POST",
      headers: { origin: "https://preview.article6.example", "content-type": "application/json" },
      body: JSON.stringify({ action: "presign", size: bytes.length, contentType: "application/pdf" }),
    }));
    presignCount += 1;
    const presigned = await presign.json() as { uploadRef: string; url: string };

    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === presigned.url && init?.method === "PUT") {
        putCount += 1;
        return new Response(null, { status: 200 });
      }
      throw new Error("unexpected browser request");
    }) as typeof fetch;
    await fetch(presigned.url, { method: "PUT", body: bytes });

    const confirmation = await postUpload(new NextRequest("https://preview.article6.example/api/quick-check/r2-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", uploadRef: presigned.uploadRef }),
    }));
    expect(confirmation.status).toBe(200);
    confirmationCount += 1;

    const extraction = await postExtract(new NextRequest("https://preview.article6.example/api/quick-check/pdf-extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadRef: presigned.uploadRef }),
    }));
    extractionCount += 1;
    expect(extraction.status).toBe(200);
    const extracted = await extraction.json() as { text: string; parsedDocument: Parameters<typeof resolveStructuredQueryContext>[2] };
    expect(extracted.text).toContain("Project");
    expect(extracted.parsedDocument).toBeDefined();

    const context = await resolveStructuredQueryContext(extracted.text, presigned.uploadRef, extracted.parsedDocument);
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
