import { sha256Text } from '@/lib/proof/hash';
import type { SourceDocument, DocumentFragment } from './types';

export async function extractPdfFragments(
  doc: SourceDocument,
  pdfBuffer: ArrayBuffer,
): Promise<DocumentFragment[]> {
  const { default: pdfParse } = await import('pdf-parse');
  const data = await pdfParse(Buffer.from(pdfBuffer));

  const fragments: DocumentFragment[] = [];

  for (let i = 0; i < data.text.length; i += 4000) {
    const pageText = data.text.slice(i, i + 4000);
    const contentSha256 = await sha256Text(pageText);
    const pageStart = Math.floor(i / 4000) + 1;
    const pageEnd = pageStart;

    fragments.push({
      fragmentId: `${doc.id}__page_${pageStart}`,
      documentId: doc.id,
      kind: 'pdd',
      index: fragments.length,
      label: `Page ${pageStart}`,
      text: pageText,
      contentSha256,
      pageStart,
      pageEnd,
    });
  }

  return fragments;
}
