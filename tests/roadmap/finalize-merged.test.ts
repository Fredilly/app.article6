import { describe, expect, test } from "@jest/globals";
import { finalizeMergedItems } from "../../scripts/roadmap/finalize-merged.mjs";
import {
  getRoadmapItemStatus,
  parseRoadmapDirective,
  setRoadmapItemStatus,
} from "../../scripts/roadmap/roadmap-lib.mjs";

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

  test("finalizes in-progress roadmap phases to done on merge", () => {
    const result = finalizeMergedItems([{ id: "RC5", status: "in_progress" }], null);
    const rc5 = result.items.find((item) => item.id === "RC5");
    expect(rc5?.status).toBe("done");
  });
});

describe("roadmap phase helpers", () => {
  test("parses RC items from Roadmap-Update blocks", () => {
    const directive = parseRoadmapDirective(`
### Roadmap-Update
- slug: requirement-coverage
- items:
  - RC5: in_progress
`);

    expect(directive).toEqual({
      slug: "requirement-coverage",
      ack: null,
      items: [{ id: "RC5", status: "in_progress" }],
    });
  });

  test("reads and writes phase status through RC ids", () => {
    const ssot = {
      phases: {
        phase_5_pdd_intake: { status: "planned", title: "PDD intake" },
      },
    };

    expect(getRoadmapItemStatus(ssot, "RC5")).toBe("planned");
    expect(setRoadmapItemStatus(ssot, "RC5", "done")).toBe(true);
    expect(getRoadmapItemStatus(ssot, "RC5")).toBe("done");
    expect(ssot.phases.phase_5_pdd_intake.status).toBe("done");
  });
});
