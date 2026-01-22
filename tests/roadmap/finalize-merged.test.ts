import { describe, expect, test } from "@jest/globals";
import { finalizeMergedItems } from "../../scripts/roadmap/finalize-merged.mjs";

describe("finalizeMergedItems", () => {
  test("forces merged pr label and in_progress item to done", () => {
    const result = finalizeMergedItems(
      [
        { id: "PR19", status: "in_progress" },
        { id: "PR20", status: "planned" },
      ],
      "PR19",
    );

    expect(result.prKey).toBe("PR19");
    const pr19 = result.items.find((item) => item.id === "PR19");
    expect(pr19?.status).toBe("done");
    const pr20 = result.items.find((item) => item.id === "PR20");
    expect(pr20?.status).toBe("planned");
  });

  test("keeps planned when not merged item", () => {
    const result = finalizeMergedItems([{ id: "PR20", status: "planned" }], "PR19");
    const pr20 = result.items.find((item) => item.id === "PR20");
    expect(pr20?.status).toBe("planned");
  });
});
