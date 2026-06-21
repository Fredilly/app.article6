import "server-only";

import {
  runDoclingHelperSync,
  parseDoclingHelperOutput,
} from "@/lib/documentParsing/adapters/doclingHelper";
import { setDoclingHelperRunnerForTests } from "@/lib/documentParsing/adapters/doclingAdapter";

export function initDoclingAdapterRuntime(): void {
  setDoclingHelperRunnerForTests(runDoclingHelperSync, parseDoclingHelperOutput);
}
