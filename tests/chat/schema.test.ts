import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "@/lib/chat/schema";

describe("ChatRequestSchema", () => {
  it("accepts a minimal valid payload", () => {
    const ok = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "hi" }]
    });
    expect(ok.success).toBe(true);
  });

  it("allows image messages without text", () => {
    const ok = ChatRequestSchema.safeParse({
      messages: [
        {
          role: "user",
          content: "",
          image: "data:image/png;base64,abc"
        }
      ]
    });
    expect(ok.success).toBe(true);
  });

  it("rejects empty messages", () => {
    const bad = ChatRequestSchema.safeParse({ messages: [] });
    expect(bad.success).toBe(false);
  });
});
