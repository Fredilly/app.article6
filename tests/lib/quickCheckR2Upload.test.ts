import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { issueUploadReference, retrieveQuickCheckUpload, verifyUploadReference } from "@/lib/quickCheck/r2Upload";

describe("Quick Check R2 upload references", () => {
  beforeEach(() => {
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    jest.restoreAllMocks();
  });

  it("binds size, content type, environment, and expiry to a signed reference", () => {
    const reference = issueUploadReference(1234);
    expect(verifyUploadReference(reference)).toMatchObject({ expectedSize: 1234, contentType: "application/pdf", environment: "preview" });
  });

  it("rejects altered and wrong-environment references", () => {
    const reference = issueUploadReference(1234);
    const [payload, signature] = reference.split(".");
    expect(() => verifyUploadReference(`${payload}x.${signature}`)).toThrow("invalid");
    process.env.VERCEL_ENV = "production";
    expect(() => verifyUploadReference(reference)).toThrow("different environment");
  });

  it("rejects expired references", () => {
    const reference = issueUploadReference(1234);
    const now = Date.now;
    Date.now = () => now() + 601_000;
    try {
      expect(() => verifyUploadReference(reference)).toThrow("expired");
    } finally {
      Date.now = now;
    }
  });

  it("retrieves the signed object and never trusts a client-supplied key", async () => {
    const reference = issueUploadReference(10);
    const send = jest.spyOn(S3Client.prototype, "send");
    send.mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: 10, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) return { ContentLength: 10, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(10) } } as never;
      throw new Error("unexpected command");
    });
    const result = await retrieveQuickCheckUpload(reference);
    expect(result.size).toBe(10);
    expect(send.mock.calls.map(([command]) => command.input.Key)).toEqual([
      expect.stringMatching(/^quick-check\/preview\//),
      expect.stringMatching(/^quick-check\/preview\//),
    ]);
  });

  it("rejects invalid and expired references before R2 retrieval", async () => {
    const send = jest.spyOn(S3Client.prototype, "send");
    expect(() => verifyUploadReference("not-a-reference")).toThrow("invalid");
    expect(send).not.toHaveBeenCalled();
    const reference = issueUploadReference(10);
    const now = Date.now;
    Date.now = () => now() + 601_000;
    try {
      await expect(retrieveQuickCheckUpload(reference)).rejects.toThrow("expired");
      expect(send).not.toHaveBeenCalled();
    } finally { Date.now = now; }
  });

  it("returns safe errors for missing, oversized, and non-PDF objects", async () => {
    const reference = issueUploadReference(10);
    const send = jest.spyOn(S3Client.prototype, "send");
    send.mockRejectedValueOnce(Object.assign(new Error("not found"), { name: "NotFound" }));
    await expect(retrieveQuickCheckUpload(reference)).rejects.toMatchObject({ code: "upload-not-found" });
    send.mockResolvedValueOnce({ ContentLength: 51 * 1024 * 1024, ContentType: "application/pdf" } as never);
    await expect(retrieveQuickCheckUpload(reference)).rejects.toMatchObject({ code: "upload-too-large" });
    send.mockResolvedValueOnce({ ContentLength: 10, ContentType: "text/plain" } as never);
    await expect(retrieveQuickCheckUpload(reference)).rejects.toMatchObject({ code: "upload-unsupported-content-type" });
  });
});
