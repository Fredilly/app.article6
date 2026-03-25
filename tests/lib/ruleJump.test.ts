import { describe, expect, it, jest } from "@jest/globals";
import { jumpToRule } from "@/lib/ruleJump";

describe("jumpToRule", () => {
  it("opens rule detail in modal URL state without dropping existing verify context", () => {
    const replace = jest.fn();
    const router = { replace } as never;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("http://localhost/m/AR-TEST0001/v/v1-0?tab=verify&mode=list"),
    });

    jumpToRule(router, "R-1");

    expect(replace).toHaveBeenCalledWith(
      "/m/AR-TEST0001/v/v1-0?tab=rules&mode=list&rule=R-1&focus=rule-detail",
      { scroll: false },
    );
  });
});
