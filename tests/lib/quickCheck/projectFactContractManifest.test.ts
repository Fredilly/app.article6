import { describe, test } from "@jest/globals";
import {
  loadProjectFactFixtureManifest,
  runProjectFactFixtureExpectation,
} from "./projectFactContractFixtureHarness";

describe("ProjectFactContract fixture manifest", () => {
  const manifest = loadProjectFactFixtureManifest();

  test.each(manifest.fixtures)("$id", (entry) => {
    runProjectFactFixtureExpectation(entry);
  });
});
