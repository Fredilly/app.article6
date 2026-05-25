import { describe, expect, it } from "@jest/globals";
import { getPrimaryNavKey } from "@/lib/nav/primaryNav";

describe("getPrimaryNavKey", () => {
  it("activates Start Review only on /start-review", () => {
    expect(getPrimaryNavKey("/start-review")).toBe("start-review");
    expect(getPrimaryNavKey("/start-review/next")).toBeNull();
    expect(getPrimaryNavKey("/")).toBeNull();
  });

  it("activates Projects only on the index and single project detail routes", () => {
    expect(getPrimaryNavKey("/projects")).toBe("projects");
    expect(getPrimaryNavKey("/projects/proj-123")).toBe("projects");
    expect(getPrimaryNavKey("/projects/new")).toBeNull();
    expect(getPrimaryNavKey("/projects/proj-123/review")).toBeNull();
  });

  it("activates Methods only on /methods", () => {
    expect(getPrimaryNavKey("/methods")).toBe("methods");
    expect(getPrimaryNavKey("/m")).toBeNull();
    expect(getPrimaryNavKey("/methods/VM0007")).toBeNull();
  });
});
