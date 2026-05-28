export const SECTION_EXCERPT_MAX_CHARS = 3000;

const SECTION_HEADING_RE = /^\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+)/i;

function stripHeaderFooterNoise(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(page\s+\d+\s+of\s+\d+|page\s+\d+|v\d+\.\d+.*|vm0007.*|project\s+description\s+document|\d+\s+of\s+\d+)$/i.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function normalizePageBreaks(text: string): string {
  return text.replace(/\f/g, "\n");
}

export function extractPddSections(rawText: string): Record<string, string> {
  const cleaned = normalizePageBreaks(stripHeaderFooterNoise(rawText));
  const sections: Record<string, string> = {};
  const lines = cleaned.split("\n");
  let currentNumber: string | null = null;
  let currentContent: string[] = [];

  function flush() {
    if (currentNumber) {
      let content = currentContent.join("\n").trim();
      if (content.length > SECTION_EXCERPT_MAX_CHARS) {
        content = content.slice(0, SECTION_EXCERPT_MAX_CHARS).replace(/\s+\S*$/, "") + " […]";
      }
      sections[currentNumber] = content;
    }
  }

  for (const line of lines) {
    const match = line.match(SECTION_HEADING_RE);
    if (match) {
      flush();
      currentNumber = match[1]!;
      currentContent = [match[2]!.trim()];
    } else if (currentNumber) {
      currentContent.push(line);
    }
  }

  flush();

  return sections;
}

export function extractSectionContent(
  rawText: string,
  sectionNumber: string,
): string | null {
  const sections = extractPddSections(rawText);
  return sections[sectionNumber] ?? null;
}

export function extractRoutedSections(
  rawText: string,
  relevantSections: string[],
): Record<string, string> {
  const allSections = extractPddSections(rawText);
  const result: Record<string, string> = {};
  for (const section of relevantSections) {
    const content = allSections[section];
    if (content) {
      result[section] = content;
    }
  }
  return result;
}
