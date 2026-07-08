export const EVIDENCE_STACK_ROLES = [
  "primary",
  "supporting",
  "caveat",
  "blocker",
] as const;

export type EvidenceStackRole = (typeof EVIDENCE_STACK_ROLES)[number];

export type EvidenceStackItem = {
  role: EvidenceStackRole;
  page: number;
  quote: string;
  sectionHeading?: string | null;
  sectionPath?: string[];
  spanId?: string | null;
  sourceType?: string | null;
  label?: string;
  reason?: string;
};

type EvidenceLike = Partial<EvidenceStackItem> & {
  role?: string | null;
};

export type EvidenceStackValidationOptions = {
  requirePrimary?: boolean;
  quoteValidator?: (
    quote: string,
    item: EvidenceStackItem,
  ) => boolean | string | { valid: boolean; reason?: string };
};

export type EvidenceStackValidationResult = {
  valid: boolean;
  errors: string[];
};

const ROLE_ORDER: Record<EvidenceStackRole, number> = {
  primary: 0,
  supporting: 1,
  caveat: 2,
  blocker: 3,
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : [];
}

function asRole(value: unknown): EvidenceStackRole {
  return EVIDENCE_STACK_ROLES.includes(value as EvidenceStackRole)
    ? (value as EvidenceStackRole)
    : "primary";
}

function normalizeEvidenceStackItem(
  item: EvidenceLike,
  fallbackRole: EvidenceStackRole = "primary",
): EvidenceStackItem {
  const quote = asTrimmedString(item.quote) ?? "";
  const page = typeof item.page === "number" ? item.page : Number(item.page);

  return {
    role: EVIDENCE_STACK_ROLES.includes(item.role as EvidenceStackRole)
      ? (item.role as EvidenceStackRole)
      : fallbackRole,
    page,
    quote,
    sectionHeading: asTrimmedString(item.sectionHeading),
    sectionPath: asStringArray(item.sectionPath),
    spanId: asTrimmedString(item.spanId),
    sourceType: asTrimmedString(item.sourceType),
    label: asTrimmedString(item.label) ?? undefined,
    reason: asTrimmedString(item.reason) ?? undefined,
  };
}

export function evidenceToStackItem(
  evidence: EvidenceLike | null | undefined,
  role: EvidenceStackRole = "primary",
): EvidenceStackItem | null {
  if (!evidence || typeof evidence !== "object") return null;
  return normalizeEvidenceStackItem(evidence, role);
}

export function normalizeEvidenceStack(input: unknown): EvidenceStackItem[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .filter((item): item is EvidenceLike => Boolean(item) && typeof item === "object")
      .map((item) => normalizeEvidenceStackItem(item, asRole(item.role)));
  }

  if (typeof input === "object") {
    const item = evidenceToStackItem(input as EvidenceLike);
    return item ? [item] : [];
  }

  return [];
}

export function sortEvidenceStack(stack: EvidenceStackItem[]): EvidenceStackItem[] {
  return stack
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const roleDelta = ROLE_ORDER[left.item.role] - ROLE_ORDER[right.item.role];
      if (roleDelta !== 0) return roleDelta;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function getPrimaryEvidence(
  stack: EvidenceStackItem[] | null | undefined,
): EvidenceStackItem | null {
  return stack?.find((item) => item.role === "primary") ?? null;
}

export function hasPrimaryEvidence(stack: EvidenceStackItem[] | null | undefined): boolean {
  return getPrimaryEvidence(stack) !== null;
}

export function groupEvidenceStackByRole(
  stack: EvidenceStackItem[] | null | undefined,
): Record<EvidenceStackRole, EvidenceStackItem[]> {
  const grouped: Record<EvidenceStackRole, EvidenceStackItem[]> = {
    primary: [],
    supporting: [],
    caveat: [],
    blocker: [],
  };

  for (const item of sortEvidenceStack(stack ?? [])) {
    grouped[item.role].push(item);
  }

  return grouped;
}

function validateQuote(
  item: EvidenceStackItem,
  quoteValidator?: EvidenceStackValidationOptions["quoteValidator"],
): string | null {
  if (!quoteValidator) return null;
  const result = quoteValidator(item.quote, item);
  if (typeof result === "boolean") return result ? null : "quote failed validation";
  if (typeof result === "string") return result || "quote failed validation";
  if (result && typeof result === "object") return result.valid ? null : (result.reason ?? "quote failed validation");
  return null;
}

export function validateEvidenceStack(
  stack: EvidenceStackItem[] | null | undefined,
  options: EvidenceStackValidationOptions = {},
): EvidenceStackValidationResult {
  const errors: string[] = [];
  const rawItems: EvidenceLike[] = Array.isArray(stack)
    ? stack.filter(Boolean).map((item) => item as EvidenceLike)
    : normalizeEvidenceStack(stack ?? []).map((item) => item as EvidenceLike);
  const normalized = normalizeEvidenceStack(stack ?? []);

  normalized.forEach((item, index) => {
    const rawRole = rawItems[index]?.role;
    if (rawRole != null && !EVIDENCE_STACK_ROLES.includes(rawRole as EvidenceStackRole)) {
      errors.push(`stack[${index}] has an invalid role "${String(rawRole)}"`);
    }
    if (!Number.isFinite(item.page) || item.page <= 0) {
      errors.push(`stack[${index}] must have a finite positive page number`);
    }
    if (!item.quote.trim()) {
      errors.push(`stack[${index}] must have a non-empty quote`);
    }
    const quoteError = validateQuote(item, options.quoteValidator);
    if (quoteError) {
      errors.push(`stack[${index}] ${quoteError}`);
    }
  });

  if (options.requirePrimary && !hasPrimaryEvidence(normalized)) {
    errors.push("FOUND/answered evidence requires at least one primary citation");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEvidenceStackForStatus(
  status: string,
  stack: EvidenceStackItem[] | null | undefined,
): EvidenceStackValidationResult {
  const normalizedStatus = status.trim().toUpperCase();
  return validateEvidenceStack(stack, {
    requirePrimary: normalizedStatus === "FOUND" || normalizedStatus === "ANSWERED",
  });
}
