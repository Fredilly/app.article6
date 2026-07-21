import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  createEvidenceMapGenerationError,
  logEvidenceMapGenerationFailure,
} from "@/lib/preverif/evidenceMapGenerationError";

describe("Evidence Map generation diagnostics", () => {
  afterEach(() => jest.restoreAllMocks());

  test("logs structured failure details without changing the error", () => {
    const error = createEvidenceMapGenerationError("GENERATION_ERROR", "draft persistence failed: duplicate audit id");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    logEvidenceMapGenerationFailure(error, "quick-check-panel/upload-evidence-map", "2026-07-21T00:00:00.000Z");

    expect(error).toEqual({
      category: "GENERATION_ERROR",
      userMessage: "Evidence Map generation failed before it could be saved. Retry the generation.",
      technicalMessage: "draft persistence failed: duplicate audit id",
    });
    expect(consoleError).toHaveBeenCalledWith({
      ...error,
      timestamp: "2026-07-21T00:00:00.000Z",
      source: "quick-check-panel/upload-evidence-map",
    });
  });
});
