const SECTION_HEADING_RE = /^\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+)/i;

export function extractPddSections(rawText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = rawText.split("\n");
  let currentNumber: string | null = null;
  let currentContent: string[] = [];

  function flush() {
    if (currentNumber) {
      sections[currentNumber] = currentContent.join("\n").trim();
    }
  }

  for (const line of lines) {
    const match = line.match(SECTION_HEADING_RE);
    if (match) {
      flush();
      currentNumber = match[1]!;
      const heading = match[2]!.trim();
      currentContent = [heading];
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
