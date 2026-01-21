import { canonicalJsonStringify } from "@/lib/auditTrail/canonicalJson";
import { sha256Hex } from "@/lib/auditTrail/hash";

describe("audit trail canonical JSON", () => {
  test("canonicalJsonStringify orders keys deterministically", () => {
    const value = { b: 1, a: 2, nested: { z: true, m: false } };
    expect(canonicalJsonStringify(value)).toBe('{"a":2,"b":1,"nested":{"m":false,"z":true}}');
  });
});

describe("audit trail hashing", () => {
  test("sha256Hex matches known digest", async () => {
    const hash = await sha256Hex("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
