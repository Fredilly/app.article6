export const MAX_QUICK_CHECK_PDF_BYTES = 50 * 1024 * 1024;

export type QuickCheckPdfRouteErrorCode = "missing-file" | "invalid-file" | "file-too-large";

export function formatQuickCheckPdfLimitLabel(): string {
  return `${(MAX_QUICK_CHECK_PDF_BYTES / (1024 * 1024)).toFixed(0)} MiB`;
}

export function isLikelyPdfBytes(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(bytes);
  let index = 0;
  while (index < view.length && view[index] !== undefined && view[index]! <= 0x20) index += 1;
  if (index + 4 > view.length) return false;
  return String.fromCharCode(view[index]!, view[index + 1]!, view[index + 2]!, view[index + 3]!) === "%PDF";
}
