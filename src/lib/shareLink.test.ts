import { decodeShareState, encodeShareState } from "@/lib/shareLink";

test("encodeShareState prefers rule over section", () => {
  const result = encodeShareState({ tab: "rules", rule: "R-1", section: "S-1" });
  expect(result.tab).toBe("rules");
  expect(result.rule).toBe("R-1");
  expect(result.section).toBeNull();
  expect(result.hash).toBe("r-R-1");
});

test("encodeShareState builds section hash when rule absent", () => {
  const result = encodeShareState({ tab: "sections", section: "S-2" });
  expect(result.tab).toBe("sections");
  expect(result.rule).toBeNull();
  expect(result.section).toBe("S-2");
  expect(result.hash).toBe("s-S-2");
});

test("decodeShareState prefers rule param over section param", () => {
  const params = new URLSearchParams("tab=rules&rule=R-9&section=S-9");
  const result = decodeShareState(params, "#s-S-1");
  expect(result.tab).toBe("rules");
  expect(result.rule).toBe("R-9");
  expect(result.section).toBeNull();
});

test("decodeShareState reads from hash when params missing", () => {
  const params = new URLSearchParams("");
  const rule = decodeShareState(params, "#r-R-2");
  expect(rule.rule).toBe("R-2");
  expect(rule.section).toBeNull();

  const section = decodeShareState(params, "#s-S-3");
  expect(section.rule).toBeNull();
  expect(section.section).toBe("S-3");
});
