export const EVIDENCE_MAP_ERROR_CATEGORIES = [
  "PDF_PARSE_ERROR",
  "METHODOLOGY_ERROR",
  "GENERATION_ERROR",
  "VALIDATION_ERROR",
  "PERSISTENCE_ERROR",
  "UNKNOWN_ERROR",
] as const;

export type EvidenceMapGenerationErrorCategory =
  (typeof EVIDENCE_MAP_ERROR_CATEGORIES)[number];

export type EvidenceMapGenerationError = {
  category: EvidenceMapGenerationErrorCategory;
  userMessage: string;
  technicalMessage: string;
  diagnostic: EvidenceMapGenerationDiagnostic;
};

export const EVIDENCE_MAP_GENERATION_STAGES = [
  "input_validation",
  "machine_proposal_generation",
  "audit_persistence",
  "draft_validation",
  "draft_persistence",
  "draft_reload_verification",
] as const;

export type EvidenceMapGenerationStage = (typeof EVIDENCE_MAP_GENERATION_STAGES)[number];

export type EvidenceMapGenerationDiagnostic = {
  diagnosticId: string;
  category: EvidenceMapGenerationErrorCategory;
  stage: EvidenceMapGenerationStage;
  technicalMessage: string;
  blockedBy: string[];
  extractedTextLength: number;
  ruleCount: number;
  evidenceFileName: string | null;
  generatedAt: string;
  browserStorage: {
    localStorageAvailable: boolean;
    localStorageUsageBytes: number | null;
    localStorageQuotaBytes: number | null;
  };
};

const USER_MESSAGES: Record<EvidenceMapGenerationErrorCategory, string> = {
  PDF_PARSE_ERROR:
    "The PDF could not be read. Upload a text-based PDF or retry the upload.",
  METHODOLOGY_ERROR:
    "The methodology or version could not be confirmed. Select VM0007 v1.8 and retry.",
  GENERATION_ERROR:
    "Evidence Map generation could not be completed. Retry generation, and confirm the uploaded PDD is available.",
  VALIDATION_ERROR:
    "The generated Evidence Map did not pass validation. Retry with a VM0007 v1.8 PDD.",
  PERSISTENCE_ERROR:
    "The Evidence Map could not be saved in browser storage. Retry generation, and check that browser storage is available.",
  UNKNOWN_ERROR:
    "Evidence Map could not be created because of an unexpected problem. Retry, and contact support if it continues.",
};

function safeTechnicalMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? "Unknown error");
  // Keep diagnostics useful without returning stacks, local paths, or multiline data.
  return message
    .split("\n", 1)[0]
    .replace(/(?:\/Users|\/home|[A-Z]:\\)[^ ]*/g, "[path]")
    .slice(0, 500);
}

function diagnosticId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `vm0007-gen-${crypto.randomUUID()}`;
  return `vm0007-gen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getBrowserStorageDiagnostics(): EvidenceMapGenerationDiagnostic["browserStorage"] {
  if (typeof window === "undefined") return { localStorageAvailable: false, localStorageUsageBytes: null, localStorageQuotaBytes: null };
  try {
    const storage = window.localStorage;
    let usage = 0;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) ?? "";
      usage += new Blob([key, storage.getItem(key) ?? ""]).size;
    }
    return {
      localStorageAvailable: true,
      localStorageUsageBytes: usage,
      localStorageQuotaBytes: null,
    };
  } catch {
    return { localStorageAvailable: false, localStorageUsageBytes: null, localStorageQuotaBytes: null };
  }
}

export function buildEvidenceMapGenerationDiagnostic(input: {
  category: EvidenceMapGenerationErrorCategory;
  stage?: EvidenceMapGenerationStage;
  technicalMessage: unknown;
  blockedBy?: readonly string[];
  extractedTextLength?: number;
  ruleCount?: number;
  evidenceFileName?: string | null;
  generatedAt?: string;
  browserStorage?: EvidenceMapGenerationDiagnostic["browserStorage"];
  sensitiveText?: string;
}): EvidenceMapGenerationDiagnostic {
  const technicalMessage = safeTechnicalMessage(input.technicalMessage);
  return {
    diagnosticId: diagnosticId(),
    category: input.category,
    stage: input.stage ?? "machine_proposal_generation",
    technicalMessage: input.sensitiveText?.trim() ? technicalMessage.replaceAll(input.sensitiveText.trim(), "[document text]") : technicalMessage,
    blockedBy: [...(input.blockedBy ?? [])],
    extractedTextLength: input.extractedTextLength ?? 0,
    ruleCount: input.ruleCount ?? 0,
    evidenceFileName: input.evidenceFileName?.trim() || null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    browserStorage: input.browserStorage ?? getBrowserStorageDiagnostics(),
  };
}

export function createEvidenceMapGenerationError(
  category: EvidenceMapGenerationErrorCategory,
  technicalMessage: unknown,
  diagnosticInput: Partial<Omit<Parameters<typeof buildEvidenceMapGenerationDiagnostic>[0], "category" | "technicalMessage">> = {},
): EvidenceMapGenerationError {
  const diagnostic = buildEvidenceMapGenerationDiagnostic({ category, technicalMessage, ...diagnosticInput });
  return {
    category,
    userMessage: USER_MESSAGES[category],
    technicalMessage: diagnostic.technicalMessage,
    diagnostic,
  };
}

export function classifyEvidenceMapGenerationError(input: {
  blockedBy?: readonly string[];
  error?: unknown;
  stage?: EvidenceMapGenerationStage;
  extractedTextLength?: number;
  ruleCount?: number;
  evidenceFileName?: string | null;
  generatedAt?: string;
  browserStorage?: EvidenceMapGenerationDiagnostic["browserStorage"];
  sensitiveText?: string;
} = {}): EvidenceMapGenerationError {
  const reasons = input.blockedBy ?? [];
  const text = safeTechnicalMessage(input.error ?? reasons.join(", "));
  const context = { stage: input.stage ?? "machine_proposal_generation", extractedTextLength: input.extractedTextLength, ruleCount: input.ruleCount, evidenceFileName: input.evidenceFileName, generatedAt: input.generatedAt, browserStorage: input.browserStorage, blockedBy: reasons, sensitiveText: input.sensitiveText };
  const errorName = input.error instanceof Error ? input.error.name : "";
  const persistence = reasons.some((reason) => /persistence|storage|reload/i.test(reason)) || /QuotaExceededError|SecurityError/i.test(errorName) || /QuotaExceededError|SecurityError|localStorage/i.test(text);
  if (persistence) return createEvidenceMapGenerationError("PERSISTENCE_ERROR", text, context);
  if (reasons.some((reason) => /methodology|version/i.test(reason))) {
    const error = createEvidenceMapGenerationError("METHODOLOGY_ERROR", text, context);
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
    const error = createEvidenceMapGenerationError("VALIDATION_ERROR", text, context);
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
    return createEvidenceMapGenerationError("GENERATION_ERROR", text, context);
  }
  if (/pdf|parse|extract|selectable text|scanned/i.test(text)) {
    return createEvidenceMapGenerationError("PDF_PARSE_ERROR", text, context);
  }
  if (input.error || reasons.some((reason) => /generation/i.test(reason))) return createEvidenceMapGenerationError("GENERATION_ERROR", text, context);
  return createEvidenceMapGenerationError("UNKNOWN_ERROR", text, context);
}
