import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/manifest/route";

describe("/api/manifest", () => {
  it("returns a non-empty manifest when requesting all entries", async () => {
    const response = await GET(new Request("http://localhost/api/manifest?all=1"));
    expect(response.ok).toBe(true);
    const payload = await response.json();
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
  });
});
