import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import fs from "fs";
import { POST } from "@/app/api/internal/article6/pdf-extract/route";
import { setPymupdfImplementationForTests } from "@/lib/documentParsing/adapters/pymupdfAdapter";

const PDF_BYTES = Buffer.from("%PDF-1.7 test-pdf");
const request = (body: Record<string, unknown>, headers: Record<string, string> = { authorization: "Bearer shared-secret", "content-type": "application/json" }) => new NextRequest("http://localhost/api/internal/article6/pdf-extract", {
  method: "POST", headers, body: JSON.stringify(body),
});

describe("POST /api/internal/article6/pdf-extract", () => {
  beforeEach(() => {
    process.env.ARTICLE6_PROCESSOR_SECRET = "shared-secret";
    process.env.ARTICLE6_PROCESSOR_ALLOWED_HOSTS = "r2.example.test";
    setPymupdfImplementationForTests(null);
    jest.restoreAllMocks();
  });

  it("requires the shared server secret", async () => {
    const response = await POST(new NextRequest("http://localhost/api/internal/article6/pdf-extract", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("rejects arbitrary document hosts before downloading and logs safe failure details", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const logMock = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await POST(request({ submissionReference: "A6-20260802-85KFMT", documentUrl: "https://evil.example.test/pdd.pdf", filename: "pdd.pdf", fileSize: 10 }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith("[api/internal/article6/pdf-extract] validation failed", expect.objectContaining({
      reason: "documentUrl hostname is not allowed",
      documentUrlType: "string",
      documentUrlLength: expect.any(Number),
      documentUrlHostname: "evil.example.test",
      allowedHosts: ["r2.example.test"],
    }));
    const loggedPayload = logMock.mock.calls.find(([message]) => message === "[api/internal/article6/pdf-extract] validation failed")?.[1] as Record<string, unknown> | undefined;
    expect(loggedPayload).toBeDefined();
    expect(Object.keys(loggedPayload ?? {})).toEqual(["reason", "documentUrlType", "documentUrlLength", "documentUrlHostname", "allowedHosts"]);
  });

  it("accepts a signed R2 URL on the allowed host", async () => {
    let parsingPath = "";
    let parsingPathExisted = false;
    setPymupdfImplementationForTests({
      isAvailable: () => true,
      parseText: ({ pdfFilePath }) => {
        parsingPath = pdfFilePath || "";
        parsingPathExisted = Boolean(parsingPath && fs.existsSync(parsingPath));
        return {
          adapterId: "pymupdf", source: "pymupdf", rawText: "Project Description\nBaseline Scenario\nLeakage\nMonitoring Plan",
          normalizedText: "Project Description\nBaseline Scenario\nLeakage\nMonitoring Plan", pages: Array.from({ length: 585 }, (_, index) => ({ pageNumber: index + 1, rawText: index === 0 ? "Project Description" : "", normalizedText: index === 0 ? "Project Description" : "", elements: [] })),
          elements: [], tables: [], parserName: "pymupdf", qualityReport: {} as never, blocks: [], headings: [], diagnostics: { metadata: { pymupdf_version: "1.24.10" } },
        };
      },
    });
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      expect(init?.redirect).toBe("error");
      return new Response(PDF_BYTES, { status: 200, headers: { "content-length": String(PDF_BYTES.length), "content-type": "application/pdf" } });
    });
    const response = await POST(request({
      submissionReference: "A6-20260802-85KFMT",
      documentUrl: "https://r2.example.test/signed?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Signature=abc123",
      filename: "pdd.pdf",
      fileSize: PDF_BYTES.length,
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload).toMatchObject({ parserEngine: "pymupdf", parserVersion: "1.24.10", pageCount: 585, extractionStatus: "completed" });
    expect(payload.extractedTextPreview).toContain("Project Description");
    expect(payload.extractedTextPreview).not.toMatch(/^%PDF/);
    expect(parsingPathExisted).toBe(true);
    expect(fs.existsSync(parsingPath)).toBe(false);
    fetchMock.mockRestore();
  });

  it("rejects PyMuPDF fallback output", async () => {
    setPymupdfImplementationForTests({
      isAvailable: () => true,
      parseText: () => ({ parserName: "current-extractor", diagnostics: { metadata: { fallback_from: "pymupdf" } } } as never),
    });
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(PDF_BYTES, { headers: { "content-length": String(PDF_BYTES.length) } }));
    const response = await POST(request({ submissionReference: "A6-20260802-85KFMT", documentUrl: "https://r2.example.test/signed", filename: "pdd.pdf", fileSize: PDF_BYTES.length }));
    expect(response.status).toBe(422);
  });

  it("rejects malformed size and PDF signature", async () => {
    const parser = jest.fn();
    setPymupdfImplementationForTests({ isAvailable: () => true, parseText: parser });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(PDF_BYTES, { headers: { "content-length": String(PDF_BYTES.length), "content-type": "application/pdf" } }));
    const wrongSize = await POST(request({ submissionReference: "A6-20260802-85KFMT", documentUrl: "https://r2.example.test/signed", filename: "pdd.pdf", fileSize: PDF_BYTES.length + 1 }));
    expect(wrongSize.status).toBe(422);
    expect(parser).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response(Buffer.from("not a pdf"), { headers: { "content-length": "10" } }));
    const wrongSignature = await POST(request({ submissionReference: "A6-20260802-85KFMT", documentUrl: "https://r2.example.test/signed", filename: "pdd.pdf", fileSize: 10 }));
    expect(wrongSignature.status).toBe(422);
    fetchMock.mockRestore();
  });
});
