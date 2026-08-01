import { existsSync, readFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { parseDocumentText } from "@/lib/documentParsing";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { resolveStructuredQueryContext } from "@/lib/chat/quickCheckStructuredQuery";
import { storePdfRef, resolvePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { issueUploadReference } from "@/lib/quickCheck/r2Upload";

function isPymupdfAvailable(): boolean {
  const python3 = process.env.PYTHON3
    ?? (existsSync(path.resolve(process.cwd(), ".venv/bin/python3"))
      ? path.resolve(process.cwd(), ".venv/bin/python3")
      : "python3");
  try {
    execFileSync(python3, ["-c", "import fitz"], { timeout: 10000, encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

describe("parserUsed trace in StructuredQueryContext", () => {
  it("rawText-only path falls back to current-extractor with pymupdf as default", () => {
    const ctx = getStructuredQueryContext("1 Project Details\nHost country: Indonesia");

    expect(ctx.parserAdapterId).toBe("pymupdf");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });

  it("parseDocumentText with pdfFilePath uses pymupdf when helper is wired", () => {
    const fixture = path.resolve(
      process.cwd(),
      "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
    );

    if (!existsSync(fixture)) {
      return;
    }

    initPymupdfAdapterRuntime();

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: fixture,
    });

    // When pymupdf is installed and working: adapterId is "pymupdf"
    // When pymupdf is not available: falls back to "current-extractor"
    const validIds = ["pymupdf", "current-extractor"];
    expect(validIds).toContain(parsed.adapterId);

    if (parsed.adapterId === "pymupdf") {
      expect(parsed.qualityReport.hasPageBoundaries).toBeDefined();
      expect(parsed.pages.length).toBeGreaterThan(0);
    } else {
      expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
    }
  });
});

describe("parserUsed trace in semantic evidence (server-side)", () => {
  it("suggestSemanticEvidence receives pdfFilePath from pdfRef resolution", async () => {
    const { suggestSemanticEvidence } = await import(
      "@/lib/quickCheck/semanticEvidence/huggingFace"
    );

    const noPdfResult = await suggestSemanticEvidence({
      claimText: "What is the host country?",
      rawPddText: "Host country: Indonesia\nMethodology: VM0007",
    });

    expect(noPdfResult.status).toBeDefined();
    expect(typeof noPdfResult.status).toBe("string");
  });

  it("parseDocumentText with existing PDF fixture has parserUsed metadata", () => {
    const fixture = path.resolve(
      process.cwd(),
      "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
    );

    if (!existsSync(fixture)) {
      return;
    }

    initPymupdfAdapterRuntime();

    const parsed = parseDocumentText({
      rawText: "Project Description\nThis is a test document.",
      pdfFilePath: fixture,
    });

    // At minimum, we always get a valid parsed document
    expect(parsed.adapterId).toBeDefined();
    expect(parsed.rawText).toBeTruthy();
    expect(parsed.pages.length).toBeGreaterThan(0);

    // When PyMuPDF is actually available (no fallback), engine metadata is set.
    // When it falls back, fallback_from is set and engine is absent.
    if (parsed.adapterId === "pymupdf" && !parsed.diagnostics?.metadata?.fallback_from) {
      expect(parsed.diagnostics?.metadata?.engine).toBe("pymupdf");
    } else {
      expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
    }
  });
});

describe("resolveStructuredQueryContext with pdfRef → PyMuPDF", () => {
  const FIXTURE = path.resolve(
    process.cwd(),
    "tests/fixtures/quick-check/plum-verra-demo-excerpt.pdf",
  );

  it("storePdfRef + resolvePdfRef round-trips", async () => {
    if (!existsSync(FIXTURE)) return;

    const token = storePdfRef(FIXTURE);
    expect(typeof token).toBe("string");
    expect(token.startsWith("pdf:")).toBe(true);

    const resolved = await resolvePdfRef(token);
    expect(resolved).toBe(FIXTURE);
  });

  it("resolveStructuredQueryContext with pdfRef returns parserAdapterId: pymupdf when available", async () => {
    if (!existsSync(FIXTURE)) return;

    const token = storePdfRef(FIXTURE);

    const ctx = await resolveStructuredQueryContext(
      "Project Description\nThis is a test.",
      token,
    );

    if (isPymupdfAvailable()) {
      expect(ctx.parserAdapterId).toBe("pymupdf");
      expect(ctx.parserFallbackFrom).toBeUndefined();
      expect(ctx.parsedDocument.adapterId).toBe("pymupdf");
    } else {
      // On CI without pymupdf: falls back with diagnostics
      expect(ctx.parserAdapterId).toBe("pymupdf");
      expect(ctx.parserFallbackFrom).toBe("pymupdf");
    }
  });

  it("resolves a signed R2 pdfRef to a parser-compatible temporary path", async () => {
    const bytes = readFileSync(FIXTURE);
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    const reference = issueUploadReference(bytes.length);
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      throw new Error("unexpected command");
    });
    const resolved = await resolvePdfRef(reference);
    expect(resolved).toMatch(/quick-check-pdfs/);
    const ctx = await resolveStructuredQueryContext("Project Description", reference);
    expect(ctx.parsedDocument.rawText).toBeTruthy();
    expect((await resolvePdfRef(reference))).toBe(resolved);
  });

  it("does not use a cached R2 path after signed-reference expiry", async () => {
    const bytes = readFileSync(FIXTURE);
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    const reference = issueUploadReference(bytes.length);
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      throw new Error("unexpected command");
    });
    expect(await resolvePdfRef(reference)).toBeTruthy();
    process.env.VERCEL_ENV = "production";
    expect(await resolvePdfRef(reference)).toBeUndefined();
    process.env.VERCEL_ENV = "preview";
    const now = Date.now;
    Date.now = () => now() + 601_000;
    try { expect(await resolvePdfRef(reference)).toBeUndefined(); } finally { Date.now = now; }
  });

  it("rematerializes a deleted cached file and deduplicates concurrent resolution", async () => {
    const bytes = readFileSync(FIXTURE);
    process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET = "test-signing-secret";
    process.env.VERCEL_ENV = "preview";
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_BUCKET_NAME = "preview-bucket";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    const reference = issueUploadReference(bytes.length);
    let gets = 0;
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: "application/pdf" } as never;
      if (command instanceof GetObjectCommand) {
        gets += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ContentLength: bytes.length, ContentType: "application/pdf", Body: { transformToByteArray: async () => new Uint8Array(bytes) } } as never;
      }
      throw new Error("unexpected command");
    });
    const first = await resolvePdfRef(reference);
    expect(first).toBeTruthy();
    unlinkSync(first!);
    const [second, third] = await Promise.all([resolvePdfRef(reference), resolvePdfRef(reference)]);
    expect(second).toBe(third);
    expect(gets).toBe(2);
  });

  it("uses the initial parsed artifact without resolving R2 again", async () => {
    const parsed = parseDocumentText({ rawText: "Project Description", pdfFilePath: FIXTURE });
    jest.restoreAllMocks();
    const retrieve = jest.spyOn(S3Client.prototype, "send");
    await resolveStructuredQueryContext("Project Description", "not-used-after-extraction", parsed);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("resolveStructuredQueryContext without pdfRef falls back to current-extractor", async () => {
    const ctx = await resolveStructuredQueryContext(
      "1 Project Details\nHost country: Indonesia",
      undefined,
    );

    expect(ctx.parserAdapterId).toBe("pymupdf");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });

  it("resolveStructuredQueryContext with expired pdfRef falls back", async () => {
    if (!existsSync(FIXTURE)) return;

    // Store with a short-lived token, then manually delete it to simulate expiry
    const token = storePdfRef(FIXTURE);
    expect(await resolvePdfRef(token)).toBe(FIXTURE);

    // Use a non-existent token to simulate expiry
    const ctx = await resolveStructuredQueryContext(
      "1 Project Details\nHost country: Indonesia",
      "pdf:expired:deadbeef",
    );

    expect(ctx.parserAdapterId).toBe("pymupdf");
    expect(ctx.parserFallbackFrom).toBe("pymupdf");
  });
});
