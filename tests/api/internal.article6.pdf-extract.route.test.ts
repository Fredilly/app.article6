import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/internal/article6/pdf-extract/route";

describe("POST /api/internal/article6/pdf-extract", () => {
  beforeEach(() => {
    process.env.ARTICLE6_PROCESSOR_SECRET = "shared-secret";
    process.env.ARTICLE6_PROCESSOR_ALLOWED_HOSTS = "r2.example.test";
  });

  it("requires the shared server secret", async () => {
    const response = await POST(new NextRequest("http://localhost/api/internal/article6/pdf-extract", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("rejects arbitrary document hosts before downloading", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const response = await POST(new NextRequest("http://localhost/api/internal/article6/pdf-extract", {
      method: "POST",
      headers: { authorization: "Bearer shared-secret", "content-type": "application/json" },
      body: JSON.stringify({ submissionReference: "A6-20260802-85KFMT", documentUrl: "https://evil.example.test/pdd.pdf", filename: "pdd.pdf", fileSize: 10 }),
    }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
