import { authorizeQuickCheckUploadOrigin } from "@/lib/quickCheck/uploadOriginPolicy";

describe("Quick Check upload origin policy", () => {
  beforeEach(() => {
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    delete process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX;
    delete process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX;
    process.env.VERCEL_ENV = "preview";
  });

  afterEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.R2_ALLOWED_UPLOAD_ORIGINS;
    delete process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX;
    delete process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX;
  });

  it("accepts exact HTTPS Production origins and rejects unconfigured origins", () => {
    process.env.VERCEL_ENV = "production";
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    expect(authorizeQuickCheckUploadOrigin("https://app.article6.example").allowed).toBe(true);
    expect(authorizeQuickCheckUploadOrigin("https://other.example").code).toBe("cors-denied");
  });

  it("keeps Production strict even when a dynamic Preview policy is configured", () => {
    process.env.VERCEL_ENV = "production";
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://app.article6.example";
    process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX = "app-article6-";
    process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX = "-fredillys-projects.vercel.app";
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-feature-fredillys-projects.vercel.app").allowed).toBe(false);
  });

  it("accepts a narrowly matched Article6 Preview hostname", () => {
    process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX = "app-article6-";
    process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX = "-fredillys-projects.vercel.app";
    expect(authorizeQuickCheckUploadOrigin("https://app-article6-feature-fredillys-projects.vercel.app").allowed).toBe(true);
  });

  it.each([
    "https://evil-project.vercel.app",
    "https://evil-app-article6-fredillys-projects.vercel.app",
    "https://app-article6-fredillys-projects.vercel.app.evil.com",
    "https://app-article6-attacker.vercel.app.evil.com",
    "http://app-article6-example-fredillys-projects.vercel.app",
    "https://app-article6-example-fredillys-projects.vercel.app:444",
    "not an origin",
  ])("rejects unsafe Preview origin %s", (origin) => {
    process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX = "app-article6-";
    process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX = "-fredillys-projects.vercel.app";
    expect(authorizeQuickCheckUploadOrigin(origin).allowed).toBe(false);
  });

  it("continues to accept exact configured origins in Preview", () => {
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "https://stable-preview.example";
    expect(authorizeQuickCheckUploadOrigin("https://stable-preview.example").allowed).toBe(true);
  });

  it("requires Preview policy configuration for an unlisted Preview origin", () => {
    const decision = authorizeQuickCheckUploadOrigin("https://app-article6-feature-fredillys-projects.vercel.app");
    expect(decision).toMatchObject({ allowed: false, code: "preview-origin-policy-not-configured", status: 503 });
  });

  it("does not implicitly allow localhost or configured paths", () => {
    expect(authorizeQuickCheckUploadOrigin("http://localhost:3000").allowed).toBe(false);
    process.env.R2_ALLOWED_UPLOAD_ORIGINS = "http://localhost:3000/path";
    expect(authorizeQuickCheckUploadOrigin("http://localhost:3000").allowed).toBe(false);
  });

  it("rejects missing and malformed Origin headers distinctly", () => {
    expect(authorizeQuickCheckUploadOrigin(null).code).toBe("origin-required");
    expect(authorizeQuickCheckUploadOrigin("https://app-article6.example/path").code).toBe("origin-invalid");
    expect(authorizeQuickCheckUploadOrigin("https://user:pass@app-article6.example").code).toBe("origin-invalid");
  });
});
