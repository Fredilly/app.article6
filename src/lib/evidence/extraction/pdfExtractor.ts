import { sha256Text } from '@/lib/proof/hash';
import type { SourceDocument, DocumentFragment } from './types';

export async function extractPdfFragments(
  doc: SourceDocument,
  pdfBuffer: ArrayBuffer,
): Promise<DocumentFragment[]> {
  const mod = await import('pdf-parse');
  const PdfParse = mod.PDFParse;
  const parser = new PdfParse({ data: new Uint8Array(pdfBuffer) });

  let result: { pages: Array<{ num: number; text: string }>; text: string };
  try {
    result = await parser.getText();
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  const fragments: DocumentFragment[] = [];

  for (const page of result.pages) {
    const contentSha256 = await sha256Text(page.text);
    fragments.push({
      fragmentId: `${doc.id}__page_${page.num}`,
      documentId: doc.id,
      kind: 'pdd',
      index: fragments.length,
      label: `Page ${page.num}`,
      text: page.text,
      contentSha256,
      pageStart: page.num,
      pageEnd: page.num,
    });
  }

  if (fragments.length === 0 && result.text) {
    const contentSha256 = await sha256Text(result.text);
    fragments.push({
      fragmentId: `${doc.id}__full`,
      documentId: doc.id,
      kind: 'pdd',
      index: 0,
      label: 'Full Document',
      text: result.text,
      contentSha256,
      pageStart: 1,
      pageEnd: 1,
    });
  }

  return fragments;
}
