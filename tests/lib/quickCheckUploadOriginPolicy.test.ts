import { authorizeQuickCheckUploadOrigin } from "@/lib/quickCheck/uploadOriginPolicy";

describe("Quick Check upload origin policy", () => {
  beforeEach(() => {
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    process.env.VERCEL_ENV = "preview";
  });

  afterEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
  });

  it("accepts a configured origin in Preview and Production", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.org";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.org").allowed).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.org").allowed).toBe(true);
  });

  it.each([undefined, "production"]) (
    "accepts an app.article6 Vercel Preview hostname when VERCEL_ENV is %s",
    (vercelEnv) => {
      if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = vercelEnv;
      delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;

      expect(authorizeQuickCheckUploadOrigin("https://app-article6-feature-123-fredillys-projects.vercel.app")).toMatchObject({
        allowed: true,
        normalizedOrigin: "https://app-article6-feature-123-fredillys-projects.vercel.app",
      });
    },
  );

  it("still requires exact R2 configuration for app.article6.org", () => {
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.org").allowed).toBe(false);

    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.org";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.org").allowed).toBe(true);
  });

  it("rejects an unconfigured origin", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("https://other.example").code).toBe("cors-denied");
  });

  it("rejects malformed origins", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("not an origin").code).toBe("origin-invalid");
  });

  it("rejects HTTP when HTTPS is configured", () => {
    process.env.VERCEL_ENV = "production";
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("http://app.article6.example").allowed).toBe(false);
  });

  it("rejects paths and credentials and normalizes the configured origin", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example/";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example/")).toMatchObject({ allowed: true, normalizedOrigin: "https://app.article6.example" });
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example/path").code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin("https://user:pass@app.article6.example").code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example:444").allowed).toBe(false);
  });

  it("rejects unrelated Vercel projects and lookalike domains", () => {
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    expect(authorizeQuickCheckUploadOrigin("https://other-app-feature-fredillys-projects.vercel.app").allowed).toBe(false);
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-feature-fredillys-projects.vercel.app.evil.example").allowed).toBe(false);
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-feature-fredillys-projects.vercel.app.attacker.com").allowed).toBe(false);
  });

  it("rejects non-origin URL forms for trusted Vercel Preview hostnames", () => {
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    const host = "app-article6-feature-fredillys-projects.vercel.app";
    expect(authorizeQuickCheckUploadOrigin(`http://${host}`).allowed).toBe(false);
    expect(authorizeQuickCheckUploadOrigin(`https://${host}/upload`).code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin(`https://${host}?debug=1`).code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin(`https://${host}#fragment`).code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin(`https://user:pass@${host}`).code).toBe("origin-invalid");
  });

  it("requires an Origin header and configured allowlist", () => {
    expect(authorizeQuickCheckUploadOrigin(null).code).toBe("origin-required");
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example")).toMatchObject({ allowed: false, code: "upload-origin-not-configured", status: 503 });
  });
});
