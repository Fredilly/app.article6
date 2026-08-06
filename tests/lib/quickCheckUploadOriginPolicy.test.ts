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
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example").allowed).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example").allowed).toBe(true);
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-git-fix-evidence-map-gen-53d19e-fredillys-projects.vercel.app").allowed).toBe(false);
  });

  it("allows the current app.article6 Vercel preview hostname without an explicit override", () => {
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-git-fix-evidence-map-gen-53d19e-fredillys-projects.vercel.app")).toEqual({
      allowed: true,
      normalizedOrigin: "https://app-article6-git-fix-evidence-map-gen-53d19e-fredillys-projects.vercel.app",
    });
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

  it("rejects unrelated and lookalike Vercel hostnames", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("https://other-project-fredillys-projects.vercel.app").allowed).toBe(false);
    expect(authorizeQuickCheckUploadOrigin("https://evil-app-article6-feature-fredillys-projects.vercel.app").allowed).toBe(false);
  });

  it("rejects HTTP Vercel preview origins", () => {
    expect(authorizeQuickCheckUploadOrigin("http://app-article6-git-fix-evidence-map-gen-53d19e-fredillys-projects.vercel.app").allowed).toBe(false);
  });

  it("requires an Origin header and configured allowlist", () => {
    expect(authorizeQuickCheckUploadOrigin(null).code).toBe("origin-required");
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example")).toMatchObject({ allowed: false, code: "upload-origin-not-configured", status: 503 });
  });
});
