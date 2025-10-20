import { describe, expect, it } from 'vitest';
import { pickTitle, pickBody, buildGroups } from "@/components/chat/SidePane";

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

  it("groups identical title/body pairs while preserving provenance", () => {
    const input = [
      {
        id: "a",
        section_title: "Title",
        text: "Body",
        refs: ["ref1"],
        methodology_id: "METH-A",
        methodology_version: "1.0",
      },
      {
        id: "b",
        section_title: "Title",
        text: "Body",
        refs: ["ref2"],
        methodology_id: "METH-B",
        methodology_version: "2.1",
      },
      { id: "c", section_title: "Different", text: "Other" },
    ];

    const groups = buildGroups(input as any);
    expect(groups).toHaveLength(2);
    const first = groups.find((g) => g.items.length === 2)!;
    expect(first.items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(first.title).toBe("Title");
    expect(first.body).toBe("Body");
    expect(first.methodologies).toEqual([
      { id: "METH-A", version: "1.0" },
      { id: "METH-B", version: "2.1" },
    ]);
  });
});
