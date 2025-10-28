import { GET } from "@/app/api/manifest/rule/[sha]/route";
import { loadManifestWithMeta } from "@/lib/manifestSource";

jest.mock("@/lib/manifestSource");

const mockedLoadManifestWithMeta = loadManifestWithMeta as jest.MockedFunction<typeof loadManifestWithMeta>;

describe("GET /api/manifest/rule/[sha]", () => {
  beforeEach(() => {
    mockedLoadManifestWithMeta.mockReset();
  });

  it("returns a JSON attachment when the SHA matches", async () => {
    const entry = {
      id: "R-1-0001",
      methodology: "AR-ACM0003",
      version: "v02-0",
      rule: "Example",
      tags: ["eligibility"],
      sha256: "abc123",
    };
    mockedLoadManifestWithMeta.mockResolvedValue({
      entries: [entry],
      source: "static",
      fetchedAt: "2025-01-01T00:00:00.000Z",
    });

    const request = new Request("http://localhost/api/manifest/rule/abc123");
    const response = await GET(request, { params: { sha: "abc123" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="rule-abc123.json"');
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const payload = await response.json();
    expect(payload).toEqual(entry);
  });

  it("returns 404 when the SHA is not found", async () => {
    mockedLoadManifestWithMeta.mockResolvedValue({
      entries: [],
      source: "static",
      fetchedAt: "2025-01-01T00:00:00.000Z",
    });

    const request = new Request("http://localhost/api/manifest/rule/missing");
    const response = await GET(request, { params: { sha: "missing" } });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/not found/i);
  });
});
