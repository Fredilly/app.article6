import { describe, expect, it } from '@jest/globals';
import { buildEchoReply } from "@/lib/chat/echo";

describe("buildEchoReply", () => {
  it("wraps user content", () => {
    const m = buildEchoReply("hello");
    expect(m.role).toBe("assistant");
    expect(m.content.toLowerCase()).toContain("hello");
  });
  it("handles empty", () => {
    const m = buildEchoReply("");
    expect(m.content).toContain("[no content]");
  });
});
