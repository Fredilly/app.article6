import { applyUrlUpdates, formatBboxParam, parseBboxParam, parseDetailTab } from "@/lib/nav/urlState";

describe("urlState", () => {
  test("applyUrlUpdates preserves unrelated params and deletes empty updates", () => {
    const params = new URLSearchParams("method=ACME&version=1.0.0&tab=overview&keep=1");
    const next = applyUrlUpdates(params, { tab: "verify", keep: null, extra: "x" });
    expect(next).toBe("method=ACME&version=1.0.0&tab=verify&extra=x");
  });

  test("parseDetailTab accepts only known tabs", () => {
    expect(parseDetailTab("verify")).toBe("verify");
    expect(parseDetailTab("map")).toBe("verify");
    expect(parseDetailTab("")).toBeNull();
    expect(parseDetailTab("nope")).toBeNull();
  });

  test("bbox param roundtrips", () => {
    const bbox: [number, number, number, number] = [-180, -45, 180, 45];
    const encoded = formatBboxParam(bbox);
    expect(parseBboxParam(encoded)).toEqual(bbox);
  });
});
