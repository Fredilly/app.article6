import "server-only";

import {
  runPymupdfHelperSync,
  parsePymupdfHelperOutput,
} from "@/lib/documentParsing/adapters/pymupdfHelper";
import { setPymupdfHelperRunnerForTests } from "@/lib/documentParsing/adapters/pymupdfAdapter";

export function initPymupdfAdapterRuntime(): void {
  setPymupdfHelperRunnerForTests(runPymupdfHelperSync, parsePymupdfHelperOutput);
}
