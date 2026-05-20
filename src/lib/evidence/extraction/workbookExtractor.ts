import { sha256Text } from '@/lib/proof/hash';
import type { SourceDocument, DocumentFragment } from './types';

export async function extractWorkbookFragments(
  doc: SourceDocument,
  workbookBuffer: ArrayBuffer,
): Promise<DocumentFragment[]> {
  const { parseWorkbookEvidenceAsset } = await import('@/lib/evidence/workbook');
  const asset = await parseWorkbookEvidenceAsset(workbookBuffer, doc.fileName, doc.mime);
  if (!asset) return [];

  const fragments: DocumentFragment[] = [];

  for (const sheet of asset.sheets) {
    const sheetText = sheet.header_columns.join('\n');
    const contentSha256 = await sha256Text(sheetText);

    fragments.push({
      fragmentId: `${doc.id}__sheet_${sheet.sheet_index}`,
      documentId: doc.id,
      kind: 'workbook',
      index: fragments.length,
      label: `Sheet: ${sheet.sheet_name}`,
      text: sheetText,
      contentSha256,
      sheetName: sheet.sheet_name,
      sheetIndex: sheet.sheet_index,
    });
  }

  return fragments;
}
