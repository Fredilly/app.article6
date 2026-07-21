export const EVIDENCE_MAP_ERROR_CATEGORIES = [
  "PDF_PARSE_ERROR",
  "METHODOLOGY_ERROR",
  "GENERATION_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN_ERROR",
] as const;

export type EvidenceMapGenerationErrorCategory =
  (typeof EVIDENCE_MAP_ERROR_CATEGORIES)[number];

export type EvidenceMapGenerationError = {
  category: EvidenceMapGenerationErrorCategory;
  userMessage: string;
  technicalMessage: string;
};

export type EvidenceMapGenerationFailureLog = EvidenceMapGenerationError & {
  timestamp: string;
  source: string;
};

/** Log only the structured, sanitized failure details. Never pass document data here. */
export function logEvidenceMapGenerationFailure(
  error: EvidenceMapGenerationError,
  source: string,
  timestamp = new Date().toISOString(),
): void {
  const entry: EvidenceMapGenerationFailureLog = {
    category: error.category,
    userMessage: error.userMessage,
    technicalMessage: error.technicalMessage,
    timestamp,
    source,
  };
  console.error(entry);
}

const USER_MESSAGES: Record<EvidenceMapGenerationErrorCategory, string> = {
  PDF_PARSE_ERROR:
    "The PDF could not be read. Upload a text-based PDF or retry the upload.",
  METHODOLOGY_ERROR:
    "The methodology or version could not be confirmed. Select VM0007 v1.8 and retry.",
  GENERATION_ERROR:
    "Evidence Map generation failed before it could be saved. Retry the generation.",
  VALIDATION_ERROR:
    "The generated Evidence Map did not pass validation. Retry with a VM0007 v1.8 PDD.",
  UNKNOWN_ERROR:
    "Evidence Map generation failed unexpectedly. Retry, and contact support if the problem continues.",
};

function safeTechnicalMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? "Unknown error");
  // Keep diagnostics useful without returning stacks, local paths, or multiline data.
  return message
    .split("\n", 1)[0]
    .replace(/(?:\/Users|\/home|[A-Z]:\\)[^ ]*/g, "[path]")
    .slice(0, 500);
}

export function createEvidenceMapGenerationError(
  category: EvidenceMapGenerationErrorCategory,
  technicalMessage: unknown,
): EvidenceMapGenerationError {
  return {
    category,
    userMessage: USER_MESSAGES[category],
    technicalMessage: safeTechnicalMessage(technicalMessage),
  };
}

export function classifyEvidenceMapGenerationError(input: {
  blockedBy?: readonly string[];
  error?: unknown;
} = {}): EvidenceMapGenerationError {
  const reasons = input.blockedBy ?? [];
  const text = safeTechnicalMessage(input.error ?? reasons.join(", "));
  if (reasons.some((reason) => /methodology|version/i.test(reason))) {
    const error = createEvidenceMapGenerationError("METHODOLOGY_ERROR", text);
    return {
      ...error,
      userMessage: reasons.includes("methodology_id_mismatch") || reasons.includes("rulebook_version_mismatch")
        ? "Evidence Map requires the VM0007 v1.8 methodology version."
        : reasons.includes("pdd_declared_version_mismatch")
          ? "Evidence Map requires a PDD that declares VM0007 v1.8."
          : error.userMessage,
    };
  }
  if (reasons.some((reason) => /malformed|missing_|duplicate_|unknown_|canonical_|audit_|rule_ids|rule_count|source_document/i.test(reason))) {
    const error = createEvidenceMapGenerationError("VALIDATION_ERROR", text);
    return {
      ...error,
      userMessage: reasons.includes("audit_not_successfully_audited")
        ? "The VM0007 evidence audit was not successfully completed."
        : reasons.includes("canonical_rule_count_is_not_58")
          ? "Evidence Map requires all 58 canonical VM0007 requirements."
          : reasons.some((reason) => ["missing_rule_ids", "duplicate_rule_ids", "unknown_rule_ids", "duplicate_canonical_rule_ids"].includes(reason))
            ? "Evidence Map could not match the complete set of 58 VM0007 requirements."
            : error.userMessage,
    };
  }
  if (/timeout|timed out|abort/i.test(text)) {
    return createEvidenceMapGenerationError("GENERATION_ERROR", text);
  }
  if (/pdf|parse|extract|selectable text|scanned/i.test(text)) {
    return createEvidenceMapGenerationError("PDF_PARSE_ERROR", text);
  }
  if (input.error || reasons.some((reason) => /persistence|generation/i.test(reason))) {
    const error = createEvidenceMapGenerationError("GENERATION_ERROR", text);
    return {
      ...error,
      userMessage: reasons.some((reason) => /persistence|validation/i.test(reason))
        ? "Evidence Map draft could not be validated or saved. You can retry."
        : "Evidence Map could not be created. You can retry.",
    };
  }
  return createEvidenceMapGenerationError("UNKNOWN_ERROR", text);
}
