import { describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

jest.mock("@/lib/quickCheck/semanticEvidence/huggingFace", () => ({
  suggestSemanticEvidenceCandidates: jest.fn(),
}));

import { GET, POST } from "@/app/api/quick-check/semantic-evidence/route";

describe("POST /api/quick-check/semantic-evidence", () => {
  it("returns 400 when claimText or rawPddText is missing", async () => {
    const response = await POST(new NextRequest("http://localhost/api/quick-check/semantic-evidence", {
      method: "POST",
      body: JSON.stringify({ claimText: "", rawPddText: "" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "missing-input" });
  });

});

describe("GET /api/quick-check/semantic-evidence", () => {
  it("reports route health and model metadata", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      model: "openbmb/MiniCPM5-1B",
    });
  });
});
