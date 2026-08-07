import { resolveMethodologyDeclarationFromText } from "@/lib/quickCheckV2/methodologyParsing";

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
  methodologyVersion: string | null;
  rulebookVersion?: string;
  versionStatus?: "VERSION_CONFIRMED" | "VERSION_NOT_CONFIRMED" | "CONFLICTING_DECLARATION";
  matchedSignals: string[];
  canonicalKeys: string[];
  priority: number;
  contextScore?: number;
};

export type QuickCheckPrimaryMethodology =
  | {
      canonicalKey: string;
      supported: true;
      matchedMethod: QuickCheckResolvedMethodology;
      secondaryCanonicalKeys: string[];
    }
  | {
      canonicalKey: string;
      supported: false;
      matchedMethod: null;
      secondaryCanonicalKeys: string[];
    };

export type QuickCheckMethodologyResolution =
  | {
      status: "none";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: [];
      unsupportedCanonicalKeys: [];
      primaryMethodology: null;
    }
  | {
      status: "single";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: [QuickCheckResolvedMethodology];
      unsupportedCanonicalKeys: [];
      primaryMethodology: QuickCheckPrimaryMethodology;
    }
  | {
      status: "deferred";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: QuickCheckResolvedMethodology[];
      unsupportedCanonicalKeys: string[];
      primaryMethodology: null;
    }
  | {
      status: "multiple";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: QuickCheckResolvedMethodology[];
      unsupportedCanonicalKeys: string[];
      primaryMethodology: QuickCheckPrimaryMethodology;
    }
  | {
      status: "unsupported";
      rawMentions: string[];
      programSignals: string[];
      signals: QuickCheckMethodologySignal[];
      matchedMethods: QuickCheckResolvedMethodology[];
      unsupportedCanonicalKeys: string[];
      primaryMethodology: QuickCheckPrimaryMethodology;
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

function resolveDeclaredVersion(rawText: string | undefined, methodologyId: string): {
  version: string | null;
  status: QuickCheckResolvedMethodology["versionStatus"];
} {
  const resolution = resolveMethodologyDeclarationFromText(rawText, methodologyId);
  return { version: resolution.version, status: resolution.status };
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

const HIGH_CONFIDENCE_HEADING_PATTERNS = [
  /title and reference of methodology/i,
  /title and reference of the vcs methodology applied/i,
  /methodology applied/i,
  /applied methodology/i,
  /vcs methodology/i,
];

const POSITIVE_CONTEXT_PATTERNS = [
  /\bapplied\b/i,
  /\bused\b/i,
  /\bselected\b/i,
  /\bproject activity\b/i,
];

const NEGATIVE_CONTEXT_PATTERNS = [
  /\bfootnote\b/i,
  /\bsupporting document\b/i,
  /\bsupporting-document\b/i,
  /\bsample[- ]size\b/i,
  /\bguidance\b/i,
  /\bexample\b/i,
  /\bapproved methodologies\b/i,
  /\bother approved methodologies\b/i,
  /\breference\b/i,
  /\breferences\b/i,
  /\bannex\b/i,
];

const JOINT_ASSESSMENT_PATTERNS = [
  /\bjoint\s+assessment\b/i,
  /\bauditor\s+qualifications?\b/i,
  /\bwork\s+carried\s+out\s+by\b/i,
  /\btechnical\s+expert\b/i,
  /\btechnical\s+reviewer\b/i,
];

const CCB_FAMILY_PATTERNS = [
  /\bccba\s+(?:project\s+)?validation\s+report\b/i,
  /\bclimate,\s*community\s*and\s*biodiversity\s+(?:project\s+)?design\s+standards?\b/i,
  /\bccb\s+(?:standards?\s+)?second\s+edition\b/i,
  /\bccb[- ]?validation\s+conclusion\b/i,
  /\bgold\s+level\b.*\bccb\b/i,
];

const VCS_FAMILY_PATTERNS = [
  /\bvcs\s+version\s+\d+\b/i,
  /\bverified\s+carbon\s+standard\s+version\s+\d+(?:\.\d+)?\b/i,
  /\bvalidation\s+report:?\s*vcs\b/i,
];

function buildSignalSearchPatterns(signal: QuickCheckMethodologySignal): RegExp[] {
  const canonical = signal.canonicalKey;
  const patterns = new Set<string>([canonical, signal.raw.trim().toUpperCase()]);
  if (/^VM\d{4}$/.test(canonical) || /^VMR\d{3,4}$/.test(canonical) || /^(?:ACM|AM)\d{4}$/.test(canonical)) {
    patterns.add(`${canonical.slice(0, 2)}\\s*${canonical.slice(2)}`);
  }
  if (/^AR-/.test(canonical)) {
    patterns.add(canonical.replace("-", "[-\\s]?"));
  }
  if (/^GS-/.test(canonical)) {
    patterns.add(canonical.replace("-", "[-\\s]?"));
  }
  return Array.from(patterns).map((pattern) => new RegExp(`\\b${pattern}\\b`, "i"));
}

function detectDocumentFamily(rawText: string | undefined): string | null {
  if (!rawText?.trim()) return null;
  const header = rawText.slice(0, 2000).toLowerCase();
  let ccbScore = 0;
  let vcsScore = 0;
  for (const pattern of CCB_FAMILY_PATTERNS) {
    if (pattern.test(header)) ccbScore += 1;
  }
  for (const pattern of VCS_FAMILY_PATTERNS) {
    if (pattern.test(header)) vcsScore += 1;
  }
  if (ccbScore > 0 && ccbScore >= vcsScore) return "CCBA/CCB";
  if (vcsScore > 0) return "VCS";
  return null;
}

function scoreMethodologyContext(rawText: string | undefined, signal: QuickCheckMethodologySignal, documentFamily?: string | null): number {
  if (!rawText?.trim()) return 0;
  const lines = rawText.split(/\r?\n/);
  const searchPatterns = buildSignalSearchPatterns(signal);
  let bestScore: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!searchPatterns.some((pattern) => pattern.test(line))) continue;

    const previous = lines[index - 1] ?? "";
    const next = lines[index + 1] ?? "";
    const localWindow = `${previous}\n${line}\n${next}`;
    let score = 0;

    if (HIGH_CONFIDENCE_HEADING_PATTERNS.some((pattern) => pattern.test(line))) score += 140;
    else if (HIGH_CONFIDENCE_HEADING_PATTERNS.some((pattern) => pattern.test(previous))) score += 120;
    else if (HIGH_CONFIDENCE_HEADING_PATTERNS.some((pattern) => pattern.test(localWindow))) score += 100;

    if (POSITIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(localWindow))) score += 20;
    if (NEGATIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(localWindow))) score -= 80;

    // CCBA/CCB joint-assessment penalty: VM methods mentioned in assessment context are supporting references
    const isVMMethod = /^VM\d{4}$/i.test(signal.canonicalKey);
    if (documentFamily === "CCBA/CCB" && isVMMethod) {
      if (JOINT_ASSESSMENT_PATTERNS.some((pattern) => pattern.test(localWindow))) score -= 120;
    }

    if (bestScore === null || score < bestScore) bestScore = score;
  }

  return bestScore ?? 0;
}

export function resolvePrimaryMethodology(input: {
  mentions: string[];
  methods: MethodInventoryRecord[];
  rawText?: string;
}): QuickCheckPrimaryMethodology | null {
  const rawMentions = Array.from(new Set(input.mentions.map((mention) => mention.trim()).filter(Boolean)));
  const methodIndex = indexMethods(input.methods);
  const scoredCandidates = new Map<string, { canonicalKey: string; supported: boolean; priority: number; contextScore: number }>();

  for (const mention of rawMentions) {
    const signal = parseMethodologySignal(mention);
    if (!signal || signal.kind !== "method") continue;
    const candidates = methodIndex.get(signal.canonicalKey) ?? [];
    const documentFamily = detectDocumentFamily(input.rawText);
    const contextScore = scoreMethodologyContext(input.rawText, signal, documentFamily);
    const existing = scoredCandidates.get(signal.canonicalKey);
    const next = {
      canonicalKey: signal.canonicalKey,
      supported: candidates.length > 0,
      priority: signal.priority,
      contextScore,
    };
    if (!existing) {
      scoredCandidates.set(signal.canonicalKey, next);
      continue;
    }
    existing.supported = existing.supported || next.supported;
    existing.priority = Math.min(existing.priority, next.priority);
    existing.contextScore = existing.contextScore === null
      ? next.contextScore
      : Math.min(existing.contextScore, next.contextScore ?? 0);
  }

  const ranked = Array.from(scoredCandidates.values()).sort(
    (left, right) =>
      right.contextScore - left.contextScore ||
      left.priority - right.priority ||
      Number(right.supported) - Number(left.supported) ||
      left.canonicalKey.localeCompare(right.canonicalKey),
  );
  if (!ranked.length) return null;

  const top = ranked[0]!;
  const second = ranked[1] ?? null;
  // Reject when the best candidate has negative context score (e.g. CCBA/CCB joint-assessment penalty)
  if ((!second && top.contextScore < 0) || (input.rawText?.trim() && ranked.length > 1 && top.contextScore <= 0)) return null;
  const ambiguous = second && top.contextScore === second.contextScore && top.priority === second.priority;
  const effectiveTop = ambiguous ? null : top;
  if (!effectiveTop) return null;

  const secondaryCanonicalKeys = ranked.slice(1).map((candidate) => candidate.canonicalKey);
  if (!effectiveTop.supported) {
    return {
      canonicalKey: effectiveTop.canonicalKey,
      supported: false,
      matchedMethod: null,
      secondaryCanonicalKeys,
    };
  }

  const matchedMethodRecord = (methodIndex.get(effectiveTop.canonicalKey) ?? [])[0];
  if (!matchedMethodRecord) {
    return {
      canonicalKey: effectiveTop.canonicalKey,
      supported: false,
      matchedMethod: null,
      secondaryCanonicalKeys,
    };
  }
  const declared = resolveDeclaredVersion(input.rawText, matchedMethodRecord.code);

  return {
    canonicalKey: effectiveTop.canonicalKey,
    supported: true,
    matchedMethod: {
      methodologyId: matchedMethodRecord.code,
      methodologyVersion: declared.version,
      rulebookVersion: pickVersion(matchedMethodRecord),
      versionStatus: declared.status,
      matchedSignals: rawMentions.filter((mention) => {
        const signal = parseMethodologySignal(mention);
        return signal?.canonicalKey === effectiveTop.canonicalKey;
      }),
      canonicalKeys: [effectiveTop.canonicalKey],
      priority: effectiveTop.priority,
      contextScore: effectiveTop.contextScore,
    },
    secondaryCanonicalKeys,
  };
}

export function resolveQuickCheckMethodology(input: {
  mentions: string[];
  methods: MethodInventoryRecord[];
  rawText?: string;
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
      primaryMethodology: null,
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
      const declared = resolveDeclaredVersion(input.rawText, method.code);
      const existing = matchedMethods.get(method.code);
      if (existing) {
        existing.matchedSignals = Array.from(new Set([...existing.matchedSignals, signal.raw]));
        existing.canonicalKeys = Array.from(new Set([...existing.canonicalKeys, signal.canonicalKey]));
        existing.priority = Math.min(existing.priority, signal.priority);
        continue;
      }
      matchedMethods.set(method.code, {
        methodologyId: method.code,
        methodologyVersion: declared.version,
        rulebookVersion: pickVersion(method),
        versionStatus: declared.status,
        matchedSignals: [signal.raw],
        canonicalKeys: [signal.canonicalKey],
        priority: signal.priority,
      });
    }
  }

  const resolvedMethods = Array.from(matchedMethods.values()).sort(
    (left, right) =>
      (right.contextScore ?? 0) - (left.contextScore ?? 0) ||
      left.priority - right.priority ||
      left.methodologyId.localeCompare(right.methodologyId),
  );
  const unsupportedCanonicalKeys = Array.from(unsupported.keys()).sort((left, right) => left.localeCompare(right));
  const primaryMethodology = resolvePrimaryMethodology(input);

  if (primaryMethodology && !primaryMethodology.supported) {
    return {
      status: "unsupported",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: resolvedMethods,
      unsupportedCanonicalKeys: Array.from(new Set([primaryMethodology.canonicalKey, ...unsupportedCanonicalKeys])),
      primaryMethodology,
    };
  }

  if (resolvedMethods.length === 1 && unsupportedCanonicalKeys.length === 0) {
    if (!primaryMethodology) {
      return {
        status: "deferred",
        rawMentions,
        programSignals,
        signals,
        matchedMethods: resolvedMethods,
        unsupportedCanonicalKeys: [],
        primaryMethodology: null,
      };
    }
    return {
      status: "single",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: [resolvedMethods[0]!],
      unsupportedCanonicalKeys: [],
      primaryMethodology,
    };
  }

  if (primaryMethodology?.supported && primaryMethodology.matchedMethod) {
      const hasStrongPrimary =
        (primaryMethodology.matchedMethod.contextScore ?? 0) > 0 ||
        primaryMethodology.secondaryCanonicalKeys.length > 0;
    if (hasStrongPrimary && resolvedMethods.length <= 1) {
      return {
        status: "single",
        rawMentions,
        programSignals,
        signals,
        matchedMethods: [primaryMethodology.matchedMethod],
        unsupportedCanonicalKeys: [],
        primaryMethodology,
      };
    }
  }

  if (resolvedMethods.length > 0) {
    if (!primaryMethodology) {
      return {
        status: "deferred",
        rawMentions,
        programSignals,
        signals,
        matchedMethods: resolvedMethods,
        unsupportedCanonicalKeys,
        primaryMethodology: null,
      };
    }
    return {
      status: "multiple",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: resolvedMethods,
      unsupportedCanonicalKeys,
      primaryMethodology,
    };
  }

  if (!primaryMethodology && unsupportedCanonicalKeys.length === 0) {
    return {
      status: "none",
      rawMentions,
      programSignals,
      signals,
      matchedMethods: [],
      unsupportedCanonicalKeys: [],
      primaryMethodology: null,
    };
  }

  return {
    status: "unsupported",
    rawMentions,
    programSignals,
    signals,
    matchedMethods: [],
    unsupportedCanonicalKeys,
    primaryMethodology: primaryMethodology ?? {
      canonicalKey: unsupportedCanonicalKeys[0] ?? "UNKNOWN",
      supported: false,
      matchedMethod: null,
      secondaryCanonicalKeys: unsupportedCanonicalKeys.slice(1),
    },
  };
}
