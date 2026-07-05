#!/usr/bin/env node
import {
  addQuickCheckV2Fixture,
  parseFixtureAddArgs,
} from "../src/lib/quickCheckV2/fixtureIntake";

addQuickCheckV2Fixture(parseFixtureAddArgs(process.argv.slice(2)))
  .then((result) => {
    console.log(`Created Quick Check v2 fixture: ${result.fixtureDir}`);
    for (const file of result.files) {
      console.log(`- ${file}`);
    }
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
