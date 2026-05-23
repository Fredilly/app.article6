import { sha256Text } from '@/lib/proof/hash';
import { extractPdfPagesWithPdfParse } from '@/lib/chat/quickCheckPdfExtractor';
import type { SourceDocument, DocumentFragment } from './types';

export async function extractPdfFragments(
  doc: SourceDocument,
  pdfBuffer: ArrayBuffer,
): Promise<DocumentFragment[]> {
  const result = await extractPdfPagesWithPdfParse({ bytes: pdfBuffer });

  const fragments: DocumentFragment[] = [];

  for (const page of result.pages) {
    const contentSha256 = await sha256Text(page.text);
    fragments.push({
      fragmentId: `${doc.id}__page_${page.pageNumber}`,
      documentId: doc.id,
      kind: 'pdd',
      index: fragments.length,
      label: `Page ${page.pageNumber}`,
      text: page.text,
      contentSha256,
      pageStart: page.pageNumber,
      pageEnd: page.pageNumber,
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
