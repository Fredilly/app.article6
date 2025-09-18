import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { POST, GET } from "@/app/api/query/route";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("/api/query route", () => {
  it("forwards POST to ENGINE_URL with bearer token", async () => {
    process.env.ENGINE_URL = "https://engine.example";
    process.env.ENGINE_BEARER = "demo-token";
    process.env.ENGINE_ADAPTER = "remote";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ engineTag: "demo", metrics: [], results: [{ id: "1", section: "section" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/query", {
      method: "POST",
      body: JSON.stringify({ query: "carbon" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toBe("https://engine.example/query");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer demo-token",
    });
    expect(json.results[0].id).toBe("1");
  });

  it("forward GET delegates query param", async () => {
    process.env.ENGINE_URL = "https://engine.example";
    process.env.ENGINE_ADAPTER = "remote";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ engineTag: "demo", metrics: [], results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("http://localhost/api/query?text=baseline"));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = init?.body as string;
    expect(JSON.parse(body)).toEqual({ query: "baseline" });
    expect(res.ok).toBe(true);
  });

  it("returns 502 when ENGINE_URL missing", async () => {
    delete process.env.ENGINE_URL;
    process.env.ENGINE_ADAPTER = "remote";

    const res = await POST(
      new Request("http://localhost/api/query", {
        method: "POST",
        body: JSON.stringify({ query: "test" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(res.status).toBe(502);
    const payload = await res.json();
    expect(payload.error).toMatch(/ENGINE_URL is not configured/);
  });
});
  it("returns demo payload when adapter is demo", async () => {
    process.env.ENGINE_ADAPTER = "demo";
    delete process.env.ENGINE_URL;
    process.env.NEXT_PUBLIC_ENGINE_TAG = "demo-tag";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new Request("http://localhost/api/query", {
        method: "POST",
        body: JSON.stringify({ query: "baseline" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engineTag).toBe("demo-tag");
    expect(body.metrics.find((m: any) => m.key === "mode")?.value).toBe("demo");
    expect(body.results.length).toBeGreaterThan(0);
  });
