import { describe, expect, it, beforeAll } from "@jest/globals";

import { GET } from "@/app/api/manifest/rule/[sha]/route";

const KNOWN_SHA = "eece4efeea1e33859370f4a08278b5e93aae51740505e98b3c7eb6e94d9f4f29";

describe("GET /api/manifest/rule/[sha]", () => {
  beforeAll(() => {
    process.env.ENGINE_ADAPTER = "demo";
  });

  it("returns a JSON attachment for a known hash", async () => {
    const request = new Request(`http://localhost/api/manifest/rule/${KNOWN_SHA}`);
    const response = await GET(request, { params: { sha: KNOWN_SHA } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("content-disposition")).toContain(`rule-${KNOWN_SHA.toLowerCase()}`);
    const json = await response.json();
    expect(json.sha256).toBe(KNOWN_SHA);
  });

  it("returns 404 when the hash is missing", async () => {
    const request = new Request("http://localhost/api/manifest/rule/not-found");
    const response = await GET(request, { params: { sha: "not-found" } });
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Rule not found");
  });
});
