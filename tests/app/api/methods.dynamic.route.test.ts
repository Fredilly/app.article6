import { describe, expect, it } from "@jest/globals";
import * as inventoryRoute from "@/app/api/methods/inventory/route";
import * as rulesRoute from "@/app/api/methods/[code]/v/[ver]/rules/route";
import * as sectionsRoute from "@/app/api/methods/[code]/v/[ver]/sections/route";
import * as richRoute from "@/app/api/methods/[code]/v/[ver]/rich/route";
import * as traceRoute from "@/app/api/methods/[code]/v/[ver]/trace/route";
import * as projectMethodsRoute from "@/app/api/projects/methods/route";
import * as projectMethodRulesRoute from "@/app/api/projects/method-rules/route";

const routeModules = [
  inventoryRoute,
  rulesRoute,
  sectionsRoute,
  richRoute,
  traceRoute,
  projectMethodsRoute,
  projectMethodRulesRoute,
];

describe("method API routes cache policy", () => {
  it.each(routeModules)("forces dynamic runtime evaluation", (routeModule) => {
    expect(routeModule.dynamic).toBe("force-dynamic");
    expect(routeModule.revalidate).toBe(0);
  });
});
