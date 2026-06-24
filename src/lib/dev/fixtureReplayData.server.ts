/**
 * Server-only contract loader for Fixture Replay.
 *
 * Reads the Cordillera Azul reliability fixture contract from disk.
 * This file MUST NOT be imported by any client component — it uses fs.
 * Import this only from server components or getServerSideProps / loaders.
 *
 * The loaded contract is passed to compareWithFixture() which is pure
 * and safe for client bundles.
 */

import fs from "fs";
import path from "path";
import type { FixtureContract } from "@/lib/dev/fixtureReplay";

const CONTRACT_RELATIVE_PATH = "tests/fixtures/quick-check/cordillera-azul-reliability-contract.json";

let cachedContract: FixtureContract | null | undefined = undefined;

/**
 * Load the Cordillera Azul fixture contract from disk.
 * Results are cached after first load.
 * Returns null if the file cannot be read or parsed.
 */
export function loadFixtureContract(): FixtureContract | null {
  if (cachedContract !== undefined) return cachedContract;
  try {
    const resolved = path.resolve(CONTRACT_RELATIVE_PATH);
    const raw = fs.readFileSync(resolved, "utf-8");
    cachedContract = JSON.parse(raw) as FixtureContract;
    return cachedContract;
  } catch {
    cachedContract = null;
    return null;
  }
}

/**
 * For testing: reset the cached contract so the next call re-reads from disk.
 */
export function resetFixtureContractCache(): void {
  cachedContract = undefined;
}
