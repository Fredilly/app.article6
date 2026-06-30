export type QuickCheckPdfPage = {
  pageNumber: number;
  text: string;
};

function normalizeQuickCheckPdfPageText(value: string): string {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatQuickCheckPdfPages(pages: QuickCheckPdfPage[]): string {
  return pages
    .map((page) => {
      const normalizedText = normalizeQuickCheckPdfPageText(page.text);
      if (!normalizedText) return "";
      return `Page ${page.pageNumber}\n${normalizedText}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
