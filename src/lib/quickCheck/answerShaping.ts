import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";

const FACT_LABEL_RE = /^(?:Project location|Project title|Host country|Project country|Crediting period|Primary methodology|Methodology modules|Baseline methodology|Monitoring methodology|Project proponent|Project country):\s*/i;

function stripFactLabel(text: string): string {
  return text.replace(FACT_LABEL_RE, "").trim();
}

// ── Location shaping ────────────────────────────────────────────────────────

const TABLE_HEADER_RE = /\b(?:Coordinate\s*[XY]|Nucleus|Table\s+\d+:)\b/i;

function shapeLocationAnswer(text: string): string {
  const raw = stripFactLabel(text)
    .replace(/\.?\s*Project country:\s*[^.]+\.?$/i, "")
    .replace(/\.?\s*Host country:\s*[^.]+\.?$/i, "")
    .trim();
  const sentences = raw.split(/(?<=[.!?])\s+/);
  const trimmed: string[] = [];
  for (const s of sentences) {
    if (s.length < 8) continue;
    if (s.split(/\s+/).filter(Boolean).length < 3) continue;
    if (TABLE_HEADER_RE.test(s)) break;
    trimmed.push(s);
    if (trimmed.length >= 3) break;
  }
  return trimmed.join(" ").replace(/\s+/g, " ").trim() || raw.slice(0, 200);
}

// ── Crediting period shaping ────────────────────────────────────────────────

const DATE_RANGE_RE = /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[–\-–]\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
const SINGLE_DATE_RE = /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
const MONTH_FIRST_DATE_RE = /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
const DURATION_RE = /\b(\d+)[-\s]?year(?:s)?\b/i;
const ISO_DATE_RE = /\b(\d{1,2}\/\w+\/\d{4})\b/g;
const DOT_DATE_RE = /\b(\d{1,2}\.\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;

function shapeCreditingPeriodAnswer(text: string): string {
  const raw = stripFactLabel(text);

  const rangeMatch = DATE_RANGE_RE.exec(raw);
  DATE_RANGE_RE.lastIndex = 0;
  const durMatch = DURATION_RE.exec(raw);

  // Collect all dates mentioned in the text
  const allDatesRaw = raw.match(SINGLE_DATE_RE) ?? [];
  SINGLE_DATE_RE.lastIndex = 0;
  const monthFirstDates = raw.match(MONTH_FIRST_DATE_RE) ?? [];
  MONTH_FIRST_DATE_RE.lastIndex = 0;
  const dotDates = raw.match(DOT_DATE_RE) ?? [];
  DOT_DATE_RE.lastIndex = 0;
  const isoDates = raw.match(ISO_DATE_RE) ?? [];

  const allDates = [...new Set([...allDatesRaw, ...monthFirstDates, ...dotDates, ...isoDates])];

  const parts: string[] = [];
  if (rangeMatch) {
    parts.push(`${rangeMatch[1]} – ${rangeMatch[2]}`);
  } else if (allDates.length >= 2) {
    parts.push(`${allDates[0]} – ${allDates[1]}`);
  } else if (allDates.length === 1) {
    parts.push(allDates[0]);
  }
  if (durMatch) {
    parts.push(`${durMatch[1]} years`);
  }
  if (parts.length > 0) return parts.join(", ");
  // Fallback: first sentence only
  const first = raw.split(/[.!?]\s+/)[0] ?? raw;
  return first.replace(/\s+/g, " ").trim();
}

// ── Methodology shaping ─────────────────────────────────────────────────────

function shapeMethodologyAnswer(text: string): string {
  const raw = stripFactLabel(text);
  // Methodology_lookup folds multiple facts (primary, modules, monitoring,
  // baseline).  Take only the methodology identifier: name + version.
  const firstFact = raw.split(/\.\s+(?:[A-Z]|Primary|Baseline|Monitoring|Sectoral)/)[0];
  const clean = firstFact
    ?.replace(/\s*\(from structured input\)\.?/gi, "")
    ?.trim();
  return clean || raw.split(/[.!?]\s+/)[0]?.trim() || raw.slice(0, 200);
}

// ── Stakeholder / section-topic shaping ─────────────────────────────────────

const SECTION_DISPLAY_RE = /^\d+(?:\.\d+)*\s+[A-Z][A-Za-z\s-]+:\s*/;

function shapeSectionTopicAnswer(text: string): string {
  // Drop the section heading prefix (e.g. "3.5 Comments by Stakeholders: ")
  const body = text.replace(SECTION_DISPLAY_RE, "").trim();
  const sentences = body.split(/(?<=[.!?])\s+/);
  // Keep first 1-3 substantive sentences, stop before lists / table rows
  const kept: string[] = [];
  for (const s of sentences) {
    if (s.length < 8) continue;
    const wc = s.split(/\s+/).filter(Boolean).length;
    if (wc < 3) continue;
    // Stop before meeting lists, table artifacts, citation dumps
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) break;
    if (/^(?:List of|Table|Figure|Source:|PROJECT DESCRIPTION)/i.test(s.trim())) break;
    if (s.startsWith("http") || s.startsWith("Available at:")) break;
    kept.push(s);
    if (kept.length >= 4) break;
  }
  return kept.join(" ").replace(/\s+/g, " ").trim() || body.slice(0, 300);
}

// ── Main shaper ─────────────────────────────────────────────────────────────

export function shapeRouterAnswerText(
  answerText: string,
  route: DeterministicRouterResult["route"],
  queryIntent?: QueryIntentAnalysis,
): string {
  if (!answerText || route === "fallback") return answerText;

  const intent = queryIntent?.intent;
  const targetFacts = queryIntent?.targetFacts ?? [];

  if (route === "project_fact_contract") {
    if (targetFacts.includes("projectLocation")) {
      return shapeLocationAnswer(answerText);
    }
    if (targetFacts.includes("creditingPeriod")) {
      return shapeCreditingPeriodAnswer(answerText);
    }
    if (
      targetFacts.includes("methodologyPrimary")
      || intent === "methodology_lookup"
    ) {
      return shapeMethodologyAnswer(answerText);
    }
  }

  if (route === "section_index") {
    return shapeSectionTopicAnswer(answerText);
  }

  return answerText;
}
