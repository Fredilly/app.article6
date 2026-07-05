import { extractMethodologyMentions } from "@/lib/chat/quickCheckEvidence";
import { normalizeDeclaredMethodologyVersion } from "@/lib/chat/methodologyVersion";

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

const CALCULATION_CONTEXT_PATTERNS = [
  /calculated using/i,
  /as per methodology/i,
  /in accordance with methodology/i,
  /formula/i,
  /equation/i,
  /parameter/i,
  /default value/i,
];

const VERSION_RE = /(?:version|v\.?)\s*(?:(\d+(?:[\.-]\d+)*(?:[\.-]\d+)?))/i;

const MODULE_CODE_RE = /^VMD\d{4}$|^VMR\d{3,4}$/;
const ACTIVITY_CODE_RE = /^(?:APD|ARR|RWE|APWD)$/;

const LINE_WINDOW = 3;

type RawMatch = {
  code: string;
  lineIndex: number;
  startIndex: number;
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
          matches.push({ code: fullMatch, lineIndex: i, startIndex: m.index ?? 0 });
        } else if (fullMatch.startsWith("AMS")) {
          const suffix = fullMatch.replace(/^AMS-?/i, "");
          if (suffix) matches.push({ code: `AMS-${suffix}`, lineIndex: i, startIndex: m.index ?? 0 });
        } else {
          const raw = (m[1] ?? m[0]).replace(/\s+/g, "").toUpperCase();
          matches.push({ code: raw, lineIndex: i, startIndex: m.index ?? 0 });
        }
      }
    }
  }
  return matches;
}

function extractNearbyVersion(lines: string[], lineIndex: number): string | null {
  const order = [lineIndex, lineIndex + 1, lineIndex - 1];
  for (const i of order) {
    if (i < 0 || i >= lines.length) continue;
    const line = lines[i] ?? "";
    const m = VERSION_RE.exec(line);
    if (m?.[0]) return normalizeDeclaredMethodologyVersion(m[0]);
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
  matchStartIndex: number,
): { role: MethodologyRole; confidence: "high" | "medium" | "low"; evidenceSection?: string; reason?: string } {
  const normalized = code.toUpperCase();

  if (isModuleOrActivity(normalized)) {
    return { role: "TOOL_OR_DEPENDENCY", confidence: "high", reason: "Module or activity signal" };
  }

  const windowLines = getLineWindow(lines, lineIndex, LINE_WINDOW);
  const windowText = windowLines.join("\n");
  const lineText = lines[lineIndex] ?? "";
  const lineMatches = findMethodologyMatches(lineText);
  const firstMatchStart = lineMatches.length > 0 ? Math.min(...lineMatches.map((match) => match.startIndex)) : matchStartIndex;
  const hasEarlierCodeInLine = matchStartIndex > firstMatchStart;

  const prevLine = lines[lineIndex - 1] ?? "";
  const nextLine = lines[lineIndex + 1] ?? "";

  const matchesMonitor = (line: string) => MONITORING_HEADING_PATTERNS.some((p) => p.test(line));
  const matchesDeclNotMonitor = (line: string) =>
    DECLARATION_HEADING_PATTERNS.some((p) => p.test(line)) && !matchesMonitor(line);
  const currentSectionTitle = sectionTitles[0] ?? "";

  const nearDeclHeading =
    matchesDeclNotMonitor(prevLine) ||
    matchesDeclNotMonitor(nextLine) ||
    getLineWindow(lines, lineIndex, 0).some((l) => matchesDeclNotMonitor(l.trim()));

  const nearMonitorHeading =
    matchesMonitor(prevLine) ||
    matchesMonitor(nextLine);

  // Only the immediate section heading should control role here. Ancestor
  // headings like B.1 should not turn later B.2/B.5 calculation references
  // into primary methodology evidence.
  const hasPrimarySection = matchesDeclNotMonitor(currentSectionTitle);
  const hasMonitoringSection = MONITORING_HEADING_PATTERNS.some((p) => p.test(currentSectionTitle));

  const inFootnote = isInFootnote(lines, lineIndex);
  const isReferenceContext =
    /\bremits to\b/i.test(windowText) ||
    /\bultimately remits to\b/i.test(windowText) ||
    /\bfor the calculation\b/i.test(windowText) ||
    /\bcalculated using\b/i.test(windowText) ||
    /\bcalculation of the\b/i.test(windowText) ||
    /\baccording to\b/i.test(windowText) ||
    /\bas per\b/i.test(windowText);

  if (hasEarlierCodeInLine && isReferenceContext) {
    return {
      role: "REFERENCED_CALCULATION_METHOD",
      confidence: "medium",
      reason: "Mention appears later in a declaration paragraph that is referencing another methodology",
    };
  }

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
  let foundHeading = false;
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i] ?? "";
    const m = /^(?:\s*(?:Section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:]?\s+(.+))\s*$/.exec(line);
    if (m?.[2]?.trim()) {
      titles.push(m[2].trim());
      foundHeading = true;
      if (!m[1]?.includes(".")) break;
      continue;
    }
    if (foundHeading && line.trim()) break;
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

function detectDocumentFamily(rawText: string): string | null {
  if (!rawText?.trim()) return null;
  const header = rawText.slice(0, 2000).toLowerCase();
  let ccbScore = 0;
  for (const pattern of CCB_FAMILY_PATTERNS) {
    if (pattern.test(header)) ccbScore += 1;
  }
  return ccbScore > 0 ? "CCBA/CCB" : null;
}

function isJointAssessmentContext(lines: string[], lineIndex: number): boolean {
  const windowLines = getLineWindow(lines, lineIndex, LINE_WINDOW);
  const windowText = windowLines.join("\n");
  return JOINT_ASSESSMENT_PATTERNS.some((p) => p.test(windowText));
}

function isCdmPddDocument(rawText: string): boolean {
  return /\bCDM[-\s]SSC[-\s]PDD\b/i.test(rawText) ||
    /\bCDM\s*[–-]\s*Executive Board\b/i.test(rawText) ||
    /\bSECTION\s+B\.\s+Application of a baseline methodology\b/i.test(rawText) ||
    /\bTitle and reference of the approved baseline methodology applied\b/i.test(rawText) ||
    /\bTitle and reference of the approved baseline and monitoring methodology\b/i.test(rawText);
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
        rawMatches.push({ code: mention, lineIndex: lineIdx, startIndex: idx });
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
  const documentFamily = detectDocumentFamily(rawText);
  for (const match of uniqueMatches) {
    const version = extractNearbyVersion(lines, match.lineIndex);
    const sectionTitles = extractSectionTitles(lines, match.lineIndex);
    const { role, confidence, evidenceSection, reason } = detectMethodologyRole(
      match.code,
      lines,
      match.lineIndex,
      sectionTitles,
      match.startIndex,
    );

    // CCBA/CCB document family override: VM methods in joint-assessment context
    // are supporting carbon-accounting references, not primary methodology
    let effectiveRole = role;
    let effectiveReason = reason;
    const isVMMethod = /^VM\d{4}$/i.test(match.code);
    if (documentFamily === "CCBA/CCB" && isVMMethod && isJointAssessmentContext(lines, match.lineIndex)) {
      effectiveRole = "REFERENCED_CALCULATION_METHOD";
      effectiveReason = "VM method in CCBA/CCB joint-assessment context — supporting reference, not primary";
    }

    entries.push({
      id: match.code,
      version,
      role: effectiveRole,
      confidence,
      evidenceSection,
      reason: effectiveReason,
    });
  }

  if (isCdmPddDocument(rawText)) {
    let primaryEstablished = false;
    for (const entry of entries) {
      if (entry.role !== "PRIMARY_PROJECT_METHODOLOGY") continue;
      if (!primaryEstablished) {
        primaryEstablished = true;
        continue;
      }
      entry.role = "REFERENCED_CALCULATION_METHOD";
      entry.reason = entry.reason
        ? `${entry.reason}; later CDM declaration reference`
        : "Later CDM declaration reference";
    }
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

  if (primary && !monitoring && !isCdmPddDocument(rawText)) {
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
