import fs from "fs";
import path from "path";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { issueUploadReference } from "@/lib/quickCheck/r2Upload";

jest.mock("@/lib/quickCheck/semanticEvidence/huggingFace", () => ({
  suggestSemanticEvidence: jest.fn(async (input: { pdfFilePath?: string }) => ({
    status: "ok",
    pdfFilePath: input.pdfFilePath,
  })),
}));

import { POST } from "@/app/api/quick-check/semantic-evidence/route";
import { suggestSemanticEvidence } from "@/lib/quickCheck/semanticEvidence/huggingFace";

describe("POST /api/quick-check/semantic-evidence with signed R2 pdfRef", () => {
  it("passes a server-materialized R2 PDF path to the semantic evidence consumer", async () => {
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    const bytes = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf"));
    const reference = issueUploadReference(bytes.length);
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      throw new Error("unexpected command");
    });
    const response = await POST(new NextRequest("http://localhost/api/quick-check/semantic-evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimText: "What is the project?", rawPddText: "Project Description", pdfRef: reference }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ok");
    expect(jest.mocked(suggestSemanticEvidence)).toHaveBeenCalledWith(expect.objectContaining({ pdfFilePath: expect.stringContaining("quick-check-pdfs") }));
  });

  it("uses the initial parser artifact without resolving a deferred R2 reference", async () => {
    jest.mocked(suggestSemanticEvidence).mockClear();
    const response = await POST(new NextRequest("http://localhost/api/quick-check/semantic-evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        claimText: "What is the project?",
        rawPddText: "Project Description",
        pdfRef: "invalid.reference",
        documentStructure: { sections: [], blocks: [] },
      }),
    }));
    expect(response.status).toBe(200);
    expect(jest.mocked(suggestSemanticEvidence)).toHaveBeenCalledWith(expect.objectContaining({ pdfFilePath: undefined, documentStructure: { sections: [], blocks: [] } }));
  });
});
