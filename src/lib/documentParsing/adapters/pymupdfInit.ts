import "server-only";

import {
  runPymupdfHelperSync,
  parsePymupdfHelperOutput,
  checkPymupdfAvailability,
} from "@/lib/documentParsing/adapters/pymupdfHelper";
import { setPymupdfHelperRunnerForTests } from "@/lib/documentParsing/adapters/pymupdfAdapter";

let _initialised = false;

export function initPymupdfAdapterRuntime(): void {
  if (_initialised) return;
  _initialised = true;

  setPymupdfHelperRunnerForTests(runPymupdfHelperSync, parsePymupdfHelperOutput);

  const availability = checkPymupdfAvailability();
  if (!availability.available) {
    console.warn("[pymupdf:vercel] PyMuPDF parser adapter is configured but the Python runtime check failed.", {
      reason: availability.reason,
      pythonPath: availability.pythonPath,
      pythonPackagesPath: availability.pythonPackagesPath ?? "not set",
      vercelEnv: process.env.VERCEL_ENV ?? "local",
    });
  } else {
    console.log("[pymupdf:vercel] PyMuPDF parser adapter is ready.", {
      pythonPath: availability.pythonPath,
      pymupdfVersion: availability.pymupdfVersion,
      pythonPackagesPath: availability.pythonPackagesPath,
    });
  }
}
