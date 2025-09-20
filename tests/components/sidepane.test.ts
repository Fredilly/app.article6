import { describe, expect, it } from "vitest";
import { pickTitle, pickBody } from "@/components/chat/SidePane";

describe("SidePane helpers", () => {
  it("prefers explicit section_title over other fields", () => {
    const title = pickTitle({ id: "node-1", section_title: "Declared title" });
    expect(title).toBe("Declared title");
  });

  it("falls back to camelCase sectionTitle", () => {
    const title = pickTitle({ id: "node-2", sectionTitle: "Camel Title" });
    expect(title).toBe("Camel Title");
  });

  it("uses first line of text when title fields absent", () => {
    const title = pickTitle({ id: "node-3", text: "Primary line\nSecondary" });
    expect(title).toBe("Primary line");
  });

  it("ultimately falls back to the id", () => {
    const title = pickTitle({ id: "node-4" });
    expect(title).toBe("node-4");
  });

  it("prefers text body but falls back to section", () => {
    expect(pickBody({ id: "node-5", text: "Body copy" })).toBe("Body copy");
    expect(pickBody({ id: "node-6", section: "Fallback" })).toBe("Fallback");
    expect(pickBody({ id: "node-7" })).toBe("");
  });
});
