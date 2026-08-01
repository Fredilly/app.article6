import { issueUploadReference, verifyUploadReference } from "@/lib/quickCheck/r2Upload";

describe("Quick Check R2 upload references", () => {
  beforeEach(() => {
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
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
    expect(() => verifyUploadReference(reference)).toThrow("invalid");
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
});
