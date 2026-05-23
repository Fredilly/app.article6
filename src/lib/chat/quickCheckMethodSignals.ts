/**
 * Quick Check Methodology Signal Resolver
 *
 * Three-tier signal classification for methodology-aware candidate gating:
 *
 *   Tier 1 — Primary methodology signals (HARD-GATE candidates)
 *   Tier 2 — Program / standard signals (NARROW to program)
 *   Tier 3 — Supporting activity/module signals (BOOST only, never resolve)
 *
 * Tier 3 signals (APD, ARR, RWE, APWD, VMD####, VMR###) MUST NOT independently
 * resolve to VM0007 or any canonical method code. They only boost ranking inside
 * an already-gated methodology.
 */

/** Matches the shape returned by GET /api/methods/inventory */
export type MethodInventoryRecord = {
  code: string;
  versions: string[];
  latestVersion?: string;
};

type AliasEntry = {
  /** Regex patterns to match against a normalized (uppercase, trimmed) mention */
  pattern: RegExp;
  /** Canonical method code — must exist in the method inventory */
  canonical: string;
  /** Lower = preferred when multiple patterns match the same mention */
  priority: number;
};

type ProgramEntry = {
  pattern: RegExp;
  program: string;
  priority: number;
};

export type DetectedMethod = {
  /** Canonical method code (e.g. "VM0007") */
  methodCode: string;
  /** How the detection was made */
  confidence: "exact-code" | "alias" | "program-derived";
  /** The original text mention that matched */
  sourceMention: string;
};

export type DetectedProgram = {
  program: string;
  confidence: "explicit" | "derived";
  sourceMention: string;
};

export type DetectedActivitySignal = {
  kind: string;
  sourceMention: string;
};

export type MethodologySignalResult = {
  /** Primary methods detected (Tier 1), deduped by canonical code */
  detectedMethods: DetectedMethod[];
  /** Programs detected (Tier 2) */
  detectedPrograms: DetectedProgram[];
  /** Activity/module signals detected (Tier 3) */
  activitySignals: DetectedActivitySignal[];
  /** All original raw mentions passed in */
  rawMentions: string[];

  // Convenience accessors
  /** Exactly one primary method was detected */
  exactlyOne: boolean;
  /** Two or more primary methods detected */
  multiplePossible: boolean;
  /** No primary methods detected at all */
  noMethodDetected: boolean;
  /** Programs detected but no primary methods */
  programOnly: boolean;
  /** Only activity/module signals, no primary methods or programs */
  activitySignalsOnly: boolean;
  /** All unique canonical codes from detected methods */
  canonicalCodes: string[];
};

// ─── Tier 1: Primary methodology signals ────────────────────────────────

/**
 * Alias registry mapping mentions → canonical method codes.
 *
 * ORDER MATTERS: first match wins for a given mention (sorted by priority).
 * Only add entries for aliases; exact code matches are handled automatically
 * by matching against the method inventory.
 */
const PRIMARY_ALIASES: AliasEntry[] = [
  // ── Verra / VCS ──
  {
    pattern: /^REDD\+\s*MF$/i,
    canonical: "VM0007",
    priority: 0,
  },
  {
    pattern: /^REDD\+\s*Methodology\s*Framework$/i,
    canonical: "VM0007",
    priority: 1,
  },

  // ── UNFCCC Agriculture ──
  {
    pattern: /^ACM\s+0010$/i,
    canonical: "ACM0010",
    priority: 0,
  },

  // ── UNFCCC Forestry (aliases if any exist beyond exact codes) ──
  // AR-ACM0003, AR-AMS0007, AR-AMS0003, AR-AM0014 matched by exact code

  // ── Gold Standard ──
  // No primary aliases — Gold Standard signals are program-level (Tier 2).
  // GS-VER1, GS-VER2, etc. are caught by detectUnavailableMethod if no
  // matching pack exists in the inventory.
];

// ─── Tier 2: Program / standard signals ──────────────────────────────────

const PROGRAM_SIGNALS: ProgramEntry[] = [
  { pattern: /^Verra$/i, program: "Verra", priority: 0 },
  { pattern: /^VCS$/i, program: "Verra", priority: 1 },
  { pattern: /^CCB$/i, program: "Verra", priority: 2 },
  { pattern: /^Verified\s*Carbon\s*Standard$/i, program: "Verra", priority: 1 },
  { pattern: /^UNFCCC$/i, program: "UNFCCC", priority: 0 },
  { pattern: /^CDM$/i, program: "UNFCCC", priority: 1 },
  { pattern: /^Gold\s*Standard$/i, program: "GoldStandard", priority: 0 },
  { pattern: /^GS4GG$/i, program: "GoldStandard", priority: 1 },
  { pattern: /^Gold\s*Standard\s*for\s*the\s*Global\s*Goals$/i, program: "GoldStandard", priority: 1 },
];

// ─── Tier 3: Supporting activity/module signals ──────────────────────────

/** These MUST NOT resolve to any canonical code. Detection only. */
const ACTIVITY_SIGNAL_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "APD", pattern: /^APD$/i },
  { kind: "ARR", pattern: /^ARR$/i },
  { kind: "RWE", pattern: /^RWE$/i },
  { kind: "APWD", pattern: /^APWD$/i },
  { kind: "VMD-module", pattern: /^VMD\d{4}$/i },
  { kind: "VMR", pattern: /^VMR\d{3,4}$/i },
];

// ─── Resolver ────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeUpper(s: string): string {
  return normalize(s).toUpperCase();
}

/**
 * Given a mention string, try to resolve it to a canonical method code
 * using the Tier 1 alias registry. Returns null if no alias matches.
 */
function resolveAlias(mention: string): AliasEntry | null {
  const normalized = normalizeUpper(mention);
  if (!normalized) return null;

  for (const entry of PRIMARY_ALIASES) {
    if (entry.pattern.test(normalized)) return entry;
  }
  return null;
}

/**
 * Check if a mention is an exact match for a method code in the inventory.
 */
function resolveExactCode(
  mention: string,
  methodCodes: Set<string>,
): string | null {
  const normalized = normalizeUpper(mention);
  // Try the raw mention first (for codes like AR-ACM0003)
  if (methodCodes.has(normalized)) return normalized;
  // Try with spaces collapsed (for codes like ACM 0010)
  const collapsed = normalized.replace(/\s+/g, "");
  if (methodCodes.has(collapsed)) return collapsed;
  return null;
}

/**
 * Resolve methodology signals from extracted mentions against the
 * available method inventory.
 *
 * @param rawMentions — strings extracted from evidence text (e.g. from extractMethodologyMentions)
 * @param methodCodes — set of method codes available in the inventory
 * @param methodProgramMap — optional map of methodCode → program for program narrowing
 */
export function resolveMethodologySignals(
  rawMentions: string[],
  methodCodes: Set<string>,
): MethodologySignalResult {
  const cleanedMentions = rawMentions
    .map((m) => normalize(m))
    .filter((m) => m.length > 0);

  const detectedMethods = new Map<string, DetectedMethod>();
  const detectedPrograms = new Map<string, DetectedProgram>();
  const activitySignals: DetectedActivitySignal[] = [];

  for (const mention of cleanedMentions) {
    // Tier 1: Try alias first (only if the canonical code exists in inventory)
    const alias = resolveAlias(mention);
    if (alias && methodCodes.has(alias.canonical)) {
      const canonical = alias.canonical;
      if (!detectedMethods.has(canonical)) {
        detectedMethods.set(canonical, {
          methodCode: canonical,
          confidence: "alias",
          sourceMention: mention,
        });
      }
      continue;
    }

    // Tier 1: Try exact code match
    const exactCode = resolveExactCode(mention, methodCodes);
    if (exactCode) {
      if (!detectedMethods.has(exactCode)) {
        detectedMethods.set(exactCode, {
          methodCode: exactCode,
          confidence: "exact-code",
          sourceMention: mention,
        });
      }
      continue;
    }

    // Tier 2: Program signals
    const normalizedUpper = normalizeUpper(mention);
    let programMatched = false;
    for (const entry of PROGRAM_SIGNALS) {
      if (entry.pattern.test(normalizedUpper)) {
        if (!detectedPrograms.has(entry.program)) {
          detectedPrograms.set(entry.program, {
            program: entry.program,
            confidence: "explicit",
            sourceMention: mention,
          });
        }
        programMatched = true;
        break;
      }
    }
    if (programMatched) continue;

    // Tier 3: Activity/module signals
    for (const entry of ACTIVITY_SIGNAL_PATTERNS) {
      if (entry.pattern.test(normalizedUpper)) {
        activitySignals.push({
          kind: entry.kind,
          sourceMention: mention,
        });
        break;
      }
    }
  }

  const methods = Array.from(detectedMethods.values());
  const programs = Array.from(detectedPrograms.values());

  // Convenience accessors
  const exactlyOne = methods.length === 1;
  const multiplePossible = methods.length >= 2;
  const noMethodDetected = methods.length === 0;
  const programOnly = noMethodDetected && programs.length > 0;
  const activitySignalsOnly =
    noMethodDetected && programs.length === 0 && activitySignals.length > 0;

  return {
    detectedMethods: methods,
    detectedPrograms: programs,
    activitySignals,
    rawMentions: cleanedMentions,
    exactlyOne,
    multiplePossible,
    noMethodDetected,
    programOnly,
    activitySignalsOnly,
    canonicalCodes: methods.map((m) => m.methodCode),
  };
}

/**
 * Given a MethodologySignalResult, determine which method codes should
 * gate candidate filtering.
 *
 * - Exactly one primary method → return [that method]
 * - Multiple primary methods → return all detected methods
 * - Program only → return all methods in that program (requires methodProgramMap)
 * - No signal → return null (no gating; broad match)
 */
export function gatingMethodCodes(
  signals: MethodologySignalResult,
  methodProgramMap?: Map<string, string>,
): string[] | null {
  if (signals.exactlyOne) {
    return [signals.detectedMethods[0]!.methodCode];
  }
  if (signals.multiplePossible) {
    return signals.canonicalCodes;
  }
  if (signals.programOnly && methodProgramMap) {
    const programs = new Set(
      signals.detectedPrograms.map((p) => p.program),
    );
    const codes: string[] = [];
    methodProgramMap.forEach((prog: string, code: string) => {
      if (programs.has(prog)) codes.push(code);
    });
    return codes.length > 0 ? codes : null;
  }
  return null;
}

/**
 * Determine the gating label for UI display.
 */
export function gatingLabel(signals: MethodologySignalResult): string | null {
  if (signals.exactlyOne) {
    return `Detected ${signals.detectedMethods[0]!.methodCode}`;
  }
  if (signals.multiplePossible) {
    return `Detected ${signals.canonicalCodes.join(", ")} — needs confirmation`;
  }
  if (signals.programOnly) {
    const programs = signals.detectedPrograms
      .map((p) => p.program)
      .join(", ");
    return `Broad within ${programs}`;
  }
  if (signals.activitySignalsOnly) {
    return "Broad/uncertain";
  }
  return null;
}

/**
 * Build a methodCode → program map from the method inventory API response.
 * This is used for program-based candidate narrowing.
 */
export function buildMethodProgramMap(
  methods: MethodInventoryRecord[],
): Map<string, string> {
  // The standard API response doesn't include program, so we infer from
  // common conventions. If the API later includes program, use that.
  const map = new Map<string, string>();

  for (const method of methods) {
    const code = method.code;
    if (code.startsWith("VM") || code.startsWith("VMD") || code.startsWith("VMR")) {
      map.set(code, "Verra");
    } else if (code.startsWith("AR-") || code.startsWith("AM") || code.startsWith("ACM")) {
      map.set(code, "UNFCCC");
    } else if (code.startsWith("GS-") || code.startsWith("GS")) {
      map.set(code, "GoldStandard");
    }
  }

  return map;
}

/**
 * Pattern that matches mentions that look like methodology codes.
 * Used to detect when evidence references a method we don't have a pack for.
 */
const METHOD_CODE_PATTERN = /\b(?:VM\d{4}|VMD\d{4}|VMR\d{3,4}|AR-ACM\d{4}|AR-AMS\d{4}|AR-AM\d{4}|ACM\d{4}|AM\d{4}|AM\d{3,4}|GS[- ]?VER\d+)\b/i;

/**
 * Check if evidence mentions contain a methodology code that isn't in our
 * inventory. Returns the first such code found, or null.
 */
export function detectUnavailableMethod(
  rawMentions: string[],
  methodCodes: Set<string>,
): string | null {
  for (const mention of rawMentions) {
    const normalized = mention.replace(/\s+/g, "").toUpperCase();
    if (!METHOD_CODE_PATTERN.test(normalized)) continue;
    const match = normalized.match(METHOD_CODE_PATTERN);
    if (!match?.[0]) continue;
    const candidate = match[0].replace(/\s+/g, "").toUpperCase();
    // Also check if it resolves via alias to something in inventory
    const resolved = resolveExactCode(mention, methodCodes);
    if (resolved) continue; // It IS in inventory, so not unavailable
    const alias = resolveAlias(mention);
    if (alias && methodCodes.has(alias.canonical)) continue; // Alias resolves to available pack
    if (!methodCodes.has(candidate)) return candidate;
  }
  return null;
}
