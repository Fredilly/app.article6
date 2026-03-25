/** @jest-environment jsdom */

import { describe, expect, it, jest } from "@jest/globals";
import { jumpToRule } from "@/lib/ruleJump";

describe("jumpToRule", () => {
  it("opens rule detail in modal URL state without dropping existing verify context", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://app.article6.test/m/AR-TEST0001/v/v1-0?tab=verify&mode=list"),
    });

    const replace = jest.fn();

    jumpToRule({ replace } as never, "R-1");

    expect(replace).toHaveBeenCalledWith(
      "/m/AR-TEST0001/v/v1-0?tab=rules&mode=list&rule=R-1&focus=rule-detail",
      { scroll: false },
    );
  });
});
