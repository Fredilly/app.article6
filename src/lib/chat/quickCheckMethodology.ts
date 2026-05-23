type MethodInventoryRecord = {
  code: string;
  versions: string[];
  latestVersion?: string;
};

export type QuickCheckMethodologySignalKind = "program" | "method" | "module";

export type QuickCheckMethodologySignal = {
  raw: string;
  canonicalKey: string;
  kind: QuickCheckMethodologySignalKind;
  priority: number;
};

export type QuickCheckResolvedMethodology = {
  methodologyId: string;
  methodologyVersion: string;
  matchedSignals: string[];
  canonicalKeys: string[];
  priority: number;
};

export type QuickCheckMethodologyResolution =
  | {
      status: "none";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: [];
      unsupportedCanonicalKeys: [];
    }
  | {
      status: "single";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: [QuickCheckResolvedMethodology];
      unsupportedCanonicalKeys: [];
    }
  | {
      status: "multiple";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: QuickCheckResolvedMethodology[];
      unsupportedCanonicalKeys: string[];
    }
  | {
      status: "unsupported";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: QuickCheckResolvedMethodology[];
      unsupportedCanonicalKeys: string[];
    };

const DIRECT_ALIAS_METHOD_KEYS = new Map<string, string>([
  ["REDD+ MF", "VM0007"],
  ["REDD+ METHODOLOGY FRAMEWORK", "VM0007"],
]);

const PROGRAM_SIGNAL_KEYS = new Set([
  "AMERICAN CARBON REGISTRY",
  "CCB",
  "CLIMATE ACTION RESERVE",
  "GOLD STANDARD",
  "GOLD STANDARD FOR THE GLOBAL GOALS",
  "GS4GG",
  "VCS",
  "VERRA",
  "VERIFIED CARBON STANDARD",
]);

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function methodSignalPriority(canonicalKey: string, kind: QuickCheckMethodologySignalKind): number {
  if (kind === "program") return 90;
  if (kind === "module") {
    if (/^VMD\d{4}$/.test(canonicalKey)) return 30;
    return 40;
  }
  if (/^VM\d{4}$/.test(canonicalKey)) return 0;
  if (/^AR-[A-Z]{2,}\d{4}$/.test(canonicalKey)) return 5;
  if (/^(?:ACM|AM)\d{4}$/.test(canonicalKey)) return 8;
  if (/^AMS[-A-Z0-9]+$/.test(canonicalKey)) return 10;
  if (/^GS-VER\d+$/.test(canonicalKey)) return 12;
  if (/^VMR\d{3,4}$/.test(canonicalKey)) return 14;
  return 20;
}

export function prioritizeMethodologyMentions(values: string[]): string[] {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return unique.sort((left, right) => {
    const leftSignal = parseMethodologySignal(left);
    const rightSignal = parseMethodologySignal(right);
    const leftPriority = leftSignal ? leftSignal.priority : 99;
    const rightPriority = rightSignal ? rightSignal.priority : 99;
    return leftPriority - rightPriority || left.localeCompare(right);
  });
}

function parseMethodologySignal(mention: string): QuickCheckMethodologySignal | null {
  const raw = mention.trim();
  const normalized = normalize(raw);
  if (!normalized) return null;

  const aliasedKey = DIRECT_ALIAS_METHOD_KEYS.get(normalized);
  if (aliasedKey) {
    return {
      raw,
      canonicalKey: aliasedKey,
      kind: "method",
      priority: methodSignalPriority(aliasedKey, "method") + 1,
    };
  }

  if (PROGRAM_SIGNAL_KEYS.has(normalized)) {
    return {
      raw,
      canonicalKey: normalized,
      kind: "program",
      priority: methodSignalPriority(normalized, "program"),
    };
  }

  const methodPatterns = [
    /^VM\d{4}$/,
    /^VMR\d{3,4}$/,
    /^ACM\d{4}$/,
    /^AM\d{4}$/,
    /^AMS[-A-Z0-9]+$/,
    /^AR-[A-Z]{2,}\d{4}$/,
    /^GS-VER\d+$/,
  ];
  if (methodPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      raw,
      canonicalKey: normalized,
      kind: "method",
      priority: methodSignalPriority(normalized, "method"),
    };
  }

  const modulePatterns = [
    /^VMD\d{4}$/,
    /^(?:APD|ARR|RWE|APWD)$/,
  ];
  if (modulePatterns.some((pattern) => pattern.test(normalized))) {
    return {
      raw,
      canonicalKey: normalized,
      kind: "module",
      priority: methodSignalPriority(normalized, "module"),
    };
  }

  return null;
}

function pickVersion(method: MethodInventoryRecord): string {
  return method.latestVersion ?? method.versions[0] ?? "";
}

function buildMethodAliasKeys(methodologyId: string): string[] {
  const normalized = normalize(methodologyId);
  const aliases = new Set<string>([
    normalized,
    normalized.replace(/\s+/g, ""),
    normalized.replace(/[-\s]/g, ""),
  ]);
  if (normalized.startsWith("AR-")) {
    const withoutPrefix = normalized.slice(3);
    aliases.add(withoutPrefix);
    aliases.add(withoutPrefix.replace(/[-\s]/g, ""));
  }
  return Array.from(aliases);
}

function indexMethods(methods: MethodInventoryRecord[]): Map<string, MethodInventoryRecord[]> {
  const index = new Map<string, MethodInventoryRecord[]>();
  for (const method of methods) {
    for (const alias of buildMethodAliasKeys(method.code)) {
      const bucket = index.get(alias) ?? [];
      bucket.push(method);
      index.set(alias, bucket);
    }
  }
  return index;
}

export function resolveQuickCheckMethodology(input: {
  mentions: string[];
  methods: MethodInventoryRecord[];
}): QuickCheckMethodologyResolution {
  const rawMentions = Array.from(new Set(input.mentions.map((mention) => mention.trim()).filter(Boolean)));
  const signals = rawMentions
    .map(parseMethodologySignal)
    .filter((signal): signal is QuickCheckMethodologySignal => Boolean(signal))
    .sort((left, right) => left.priority - right.priority || left.raw.localeCompare(right.raw));
  const programSignals = signals.filter((signal) => signal.kind === "program").map((signal) => signal.raw);
  const primarySignals = signals.filter((signal) => signal.kind === "method");

  if (!primarySignals.length) {
    return {
      status: "none",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: [],
      unsupportedCanonicalKeys: [],
    };
  }

  const methodIndex = indexMethods(input.methods);
  const matchedMethods = new Map<string, QuickCheckResolvedMethodology>();
  const unsupported = new Map<string, string[]>();

  for (const signal of primarySignals) {
    const candidates = methodIndex.get(signal.canonicalKey) ?? [];
    if (!candidates.length) {
      const bucket = unsupported.get(signal.canonicalKey) ?? [];
      bucket.push(signal.raw);
      unsupported.set(signal.canonicalKey, Array.from(new Set(bucket)));
      continue;
    }
    for (const method of candidates) {
      const methodologyVersion = pickVersion(method);
      if (!methodologyVersion) continue;
      const existing = matchedMethods.get(method.code);
      if (existing) {
        existing.matchedSignals = Array.from(new Set([...existing.matchedSignals, signal.raw]));
        existing.canonicalKeys = Array.from(new Set([...existing.canonicalKeys, signal.canonicalKey]));
        existing.priority = Math.min(existing.priority, signal.priority);
        continue;
      }
      matchedMethods.set(method.code, {
        methodologyId: method.code,
        methodologyVersion,
        matchedSignals: [signal.raw],
        canonicalKeys: [signal.canonicalKey],
        priority: signal.priority,
      });
    }
  }

  const resolvedMethods = Array.from(matchedMethods.values()).sort(
    (left, right) =>
      left.priority - right.priority ||
      left.methodologyId.localeCompare(right.methodologyId),
  );
  const unsupportedCanonicalKeys = Array.from(unsupported.keys()).sort((left, right) => left.localeCompare(right));

  if (resolvedMethods.length === 1 && unsupportedCanonicalKeys.length === 0) {
    return {
      status: "single",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: [resolvedMethods[0]!],
      unsupportedCanonicalKeys: [],
    };
  }

  if (resolvedMethods.length > 0) {
    return {
      status: "multiple",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: resolvedMethods,
      unsupportedCanonicalKeys,
    };
  }

  return {
    status: "unsupported",
    rawMentions,
    programSignals,
    signals,
    matchedMethods: [],
    unsupportedCanonicalKeys,
  };
}
