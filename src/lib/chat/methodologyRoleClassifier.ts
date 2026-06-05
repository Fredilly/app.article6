import { extractMethodologyMentions } from "@/lib/chat/quickCheckEvidence";

export type MethodologyRole =
  | "PRIMARY_PROJECT_METHODOLOGY"
  | "MONITORING_METHODOLOGY"
  | "REFERENCED_CALCULATION_METHOD"
  | "TOOL_OR_DEPENDENCY"
  | "BACKGROUND_MENTION"
  | "UNKNOWN";

export type MethodologyEntry = {
  id: string;
  version: string | null;
  role: MethodologyRole;
  confidence: "high" | "medium" | "low";
  evidenceSection?: string;
  reason?: string;
};

export type MethodologyClassification = {
  primaryMethodology: MethodologyEntry | null;
  monitoringMethodology: MethodologyEntry | null;
  referencedMethods: MethodologyEntry[];
};

const DECLARATION_HEADING_PATTERNS = [
  /title and reference of (?:approved baseline )?methodology applied/i,
  /title and reference of the vcs methodology applied/i,
  /title and reference of approved baseline methodology/i,
  /title and reference of methodology/i,
  /methodology applied/i,
  /applied methodology/i,
  /the methodology used/i,
  /vcs methodology/i,
  /project category applicable/i,
];

const MONITORING_HEADING_PATTERNS = [
  /name and reference of approved monitoring methodology applied/i,
  /monitoring methodology/i,
  /monitoring plan/i,
  /monitoring applied/i,
];

const FOOTNOTE_LINE_RE = /^footnote\s+\d+/im;

const BACKGROUND_NEGATIVE_PATTERNS = [
  /\bexample\b/i,
  /\bguidance\b/i,
  /\bsample[- ]size\b/i,
  /\bunrelated\b/i,
  /\bother approved methodologies\b/i,
  /\bsupporting[- ]?document\b/i,
  /\breferences(?!\s+of methodology)/i,
  /\bbibliography\b/i,
  /\bannex\b/i,
];

const CALCULATION_CONTEXT_PATTERNS = [
  /calculated using/i,
  /as per methodology/i,
  /in accordance with methodology/i,
  /formula/i,
  /equation/i,
  /parameter/i,
  /default value/i,
];

const VERSION_RE = /(?:version|v)\s*(?:(\d+(?:[\.-]\d+)*(?:[\.-]\d+)?))/i;

const MODULE_CODE_RE = /^VMD\d{4}$|^VMR\d{3,4}$/;
const ACTIVITY_CODE_RE = /^(?:APD|ARR|RWE|APWD)$/;

const LINE_WINDOW = 3;

type RawMatch = {
  code: string;
  lineIndex: number;
};

function findMethodologyMatches(text: string): RawMatch[] {
  const lines = text.split("\n");
  const matches: RawMatch[] = [];

  const patterns = [
    /\b(VM\d{4})\b/g,
    /\b(VMR\d{3,4})\b/g,
    /\b(VMD\d{4})\b/g,
    /\b(ACM\d{4})\b/g,
    /\b(AM\d{4})\b/g,
    /\b(AR-(?:ACM|AMS|AM)\d{4})\b/g,
    /\b(APD|ARR|RWE|APWD)\b/g,
    /\bGS[- ]?(VER\d+)\b/gi,
    /\b(AMS[- ]?[A-Z]\w+(?:\.\w+)*)\b/gi,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        const fullMatch = m[0].replace(/\s+/g, "").toUpperCase();
        if (/^GS/.test(fullMatch)) {
          matches.push({ code: fullMatch, lineIndex: i });
        } else if (fullMatch.startsWith("AMS")) {
          const suffix = fullMatch.replace(/^AMS-?/i, "");
          if (suffix) matches.push({ code: `AMS-${suffix}`, lineIndex: i });
        } else {
          const raw = (m[1] ?? m[0]).replace(/\s+/g, "").toUpperCase();
          matches.push({ code: raw, lineIndex: i });
        }
      }
    }
  }
  return matches;
}

function extractNearbyVersion(lines: string[], lineIndex: number): string | null {
  const start = Math.max(0, lineIndex - 1);
  const end = Math.min(lines.length, lineIndex + 2);
  for (let i = start; i < end; i++) {
    const line = lines[i] ?? "";
    const m = VERSION_RE.exec(line);
    if (m?.[1]) return m[1];
  }
  return null;
}

function getLineWindow(lines: string[], lineIndex: number, windowSize: number): string[] {
  const start = Math.max(0, lineIndex - windowSize);
  const end = Math.min(lines.length, lineIndex + windowSize + 1);
  return lines.slice(start, end);
}

function isInFootnote(lines: string[], lineIndex: number): boolean {
  return getLineWindow(lines, lineIndex, 2).some((l) => FOOTNOTE_LINE_RE.test(l.trim()));
}

function isModuleOrActivity(code: string): boolean {
  return MODULE_CODE_RE.test(code) || ACTIVITY_CODE_RE.test(code);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectMethodologyRole(
  code: string,
  lines: string[],
  lineIndex: number,
  sectionTitles: string[],
): { role: MethodologyRole; confidence: "high" | "medium" | "low"; evidenceSection?: string; reason?: string } {
  const normalized = code.toUpperCase();

  if (isModuleOrActivity(normalized)) {
    return { role: "TOOL_OR_DEPENDENCY", confidence: "high", reason: "Module or activity signal" };
  }

  const windowLines = getLineWindow(lines, lineIndex, LINE_WINDOW);
  const windowText = windowLines.join("\n");

  const prevLine = lines[lineIndex - 1] ?? "";
  const nextLine = lines[lineIndex + 1] ?? "";

  const matchesMonitor = (line: string) => MONITORING_HEADING_PATTERNS.some((p) => p.test(line));
  const matchesDeclNotMonitor = (line: string) =>
    DECLARATION_HEADING_PATTERNS.some((p) => p.test(line)) && !matchesMonitor(line);

  const nearDeclHeading =
    matchesDeclNotMonitor(prevLine) ||
    matchesDeclNotMonitor(nextLine) ||
    getLineWindow(lines, lineIndex, 0).some((l) => matchesDeclNotMonitor(l.trim()));

  const nearMonitorHeading =
    matchesMonitor(prevLine) ||
    matchesMonitor(nextLine);

  const hasPrimarySection = sectionTitles.some((t) => DECLARATION_HEADING_PATTERNS.some((p) => p.test(t)));
  const hasMonitoringSection = sectionTitles.some((t) => MONITORING_HEADING_PATTERNS.some((p) => p.test(t)));

  const inFootnote = isInFootnote(lines, lineIndex);

  if (nearMonitorHeading || hasMonitoringSection) {
    if (nearDeclHeading || hasPrimarySection) {
      return { role: "PRIMARY_PROJECT_METHODOLOGY", confidence: "high", evidenceSection: sectionTitles.join("; ") };
    }
    return { role: "MONITORING_METHODOLOGY", confidence: "high", evidenceSection: sectionTitles.join("; ") };
  }

  if (nearDeclHeading || hasPrimarySection) {
    return { role: "PRIMARY_PROJECT_METHODOLOGY", confidence: "high", evidenceSection: sectionTitles.join("; ") };
  }

  if (inFootnote) {
    return { role: "BACKGROUND_MENTION", confidence: "low", reason: "Mention appears in footnote context" };
  }

  const isCalcContext = CALCULATION_CONTEXT_PATTERNS.some((p) => p.test(windowText));

  if (isCalcContext) {
    return { role: "REFERENCED_CALCULATION_METHOD", confidence: "medium", reason: "Mentioned in calculation context" };
  }

  const isBackgroundNeg = BACKGROUND_NEGATIVE_PATTERNS.some((p) => p.test(windowText));

  if (isBackgroundNeg) {
    return { role: "BACKGROUND_MENTION", confidence: "low", reason: "Mentioned in background or supporting context" };
  }

  const lineText = lines[lineIndex] ?? "";

  const isStandalone = /^\s*[A-Z][A-Z0-9-]{2,}\s*$/.test(lineText.trim());

  if (isStandalone) {
    return { role: "PRIMARY_PROJECT_METHODOLOGY", confidence: "medium", reason: "Standalone code on its own line" };
  }

  const hasCodeAtLineStart = new RegExp(`^\\s*${escapeRegex(normalized)}`).test(lineText) &&
    !lineText.includes("as specified") &&
    !lineText.includes("according to") &&
    !lineText.includes("calculated") &&
    !lineText.includes("example") &&
    !lineText.includes("guidance");

  if (hasCodeAtLineStart) {
    return { role: "PRIMARY_PROJECT_METHODOLOGY", confidence: "medium", reason: "Code appears at start of its line" };
  }

  return { role: "UNKNOWN", confidence: "low" };
}

function extractSectionTitles(lines: string[], lineIndex: number): string[] {
  const titles: string[] = [];
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i] ?? "";
    const m = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+))\s*$/.exec(line);
    if (m?.[2]?.trim()) {
      titles.push(m[2].trim());
      if (!m[1]?.includes(".")) break;
    }
  }
  return titles;
}

function dedupeEntries(entries: MethodologyEntry[]): MethodologyEntry[] {
  const seen = new Map<string, MethodologyEntry>();

  for (const entry of entries) {
    const key = `${entry.id}|${entry.version ?? ""}|${entry.role}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, entry);
      continue;
    }
    const confRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if ((confRank[entry.confidence] ?? 2) < (confRank[existing.confidence] ?? 2)) {
      seen.set(key, entry);
    }
  }

  return Array.from(seen.values());
}

export function classifyMethodologyRoles(rawText: string): MethodologyClassification {
  if (!rawText?.trim()) {
    return { primaryMethodology: null, monitoringMethodology: null, referencedMethods: [] };
  }

  const lines = rawText.split("\n");
  const rawMatches = findMethodologyMatches(rawText);

  if (!rawMatches.length) {
    const extracted = extractMethodologyMentions(rawText);
    for (const mention of extracted) {
      const idx = rawText.indexOf(mention);
      if (idx >= 0) {
        const lineIdx = rawText.slice(0, idx).split("\n").length - 1;
        rawMatches.push({ code: mention, lineIndex: lineIdx });
      }
    }
  }

  const seen = new Map<string, RawMatch>();
  for (const m of rawMatches) {
    const key = `${m.code}:${m.lineIndex}`;
    if (!seen.has(key)) seen.set(key, m);
  }
  const uniqueMatches = Array.from(seen.values());

  const entries: MethodologyEntry[] = [];
  for (const match of uniqueMatches) {
    const version = extractNearbyVersion(lines, match.lineIndex);
    const sectionTitles = extractSectionTitles(lines, match.lineIndex);
    const { role, confidence, evidenceSection, reason } = detectMethodologyRole(
      match.code,
      lines,
      match.lineIndex,
      sectionTitles,
    );

    entries.push({
      id: match.code,
      version,
      role,
      confidence,
      evidenceSection,
      reason,
    });
  }

  const deduped = dedupeEntries(entries);

  let primary = deduped.find((e) => e.role === "PRIMARY_PROJECT_METHODOLOGY") ?? null;
  let monitoring = deduped.find((e) => e.role === "MONITORING_METHODOLOGY") ?? null;

  if (!primary && !monitoring) {
    const unknownNonModules = deduped.filter(
      (e) => e.role === "UNKNOWN" && !isModuleOrActivity(e.id),
    );
    if (unknownNonModules.length === 1) {
      primary = {
        ...unknownNonModules[0]!,
        role: "PRIMARY_PROJECT_METHODOLOGY",
        confidence: "low",
        reason: "Only methodology reference found in document",
      };
    }
  }

  if (primary && !monitoring) {
    const maybeMonitor = deduped.find(
      (e) =>
        e.id !== primary!.id &&
        (e.role === "REFERENCED_CALCULATION_METHOD" || e.role === "UNKNOWN") &&
        !isModuleOrActivity(e.id) &&
        e.confidence !== "low",
    );
    if (maybeMonitor) {
      monitoring = {
        ...maybeMonitor,
        role: "MONITORING_METHODOLOGY",
        confidence: "medium",
        reason: "Secondary methodology distinct from primary",
      };
    }
  }

  const referencedMethods = deduped.filter((e) => {
    if (primary && e.id === primary.id) return false;
    if (monitoring && e.id === monitoring.id) return false;
    return true;
  });

  return { primaryMethodology: primary, monitoringMethodology: monitoring, referencedMethods };
}
