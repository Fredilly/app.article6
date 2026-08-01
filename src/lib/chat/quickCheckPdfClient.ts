import { extractMethodologyMentions, type QuickCheckPdfParserDebug, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";
import { formatQuickCheckPdfPages, type QuickCheckPdfPage } from "@/lib/chat/quickCheckPdfPages";
import { isLikelyPdfBytes, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
export type QuickCheckUploadProgress = (percent: number) => void;
const RECOVERED_TEXT_WARNING = "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.";
export type QuickCheckPdfUploadCache = Map<string, Promise<QuickCheckResolvedPdfText>>;
export function createQuickCheckPdfUploadCache(): QuickCheckPdfUploadCache { return new Map(); }
const defaultUploadCache = createQuickCheckPdfUploadCache();
export function clearQuickCheckUploadCache() { defaultUploadCache.clear(); }
export async function resolveQuickCheckPdfText(input: { attachmentId?: string; sha256?: string; uploadCache?: QuickCheckPdfUploadCache; bytes: ArrayBuffer; filename: string; onProgress?: QuickCheckUploadProgress; onConfirm?: () => void; onConfirmed?: () => void; onRetrieving?: () => void; onExtracting?: () => void; onRunning?: () => void }): Promise<QuickCheckResolvedPdfText> {
  const { bytes, onProgress, onConfirm, onConfirmed, onRetrieving, onExtracting, onRunning } = input;
  if (bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES) throw new Error("PDF exceeds the Quick Check upload limit of 50 MiB.");
  if (!isLikelyPdfBytes(bytes)) throw new Error("Only valid PDF files can be uploaded.");
  const cacheKeys = [input.sha256?.trim(), input.attachmentId?.trim()].filter((key): key is string => Boolean(key));
  const cache = input.uploadCache ?? defaultUploadCache;
  const existing = cacheKeys.map((key) => cache.get(key)).find(Boolean);
  if (existing) {
    for (const key of cacheKeys) cache.set(key, existing);
    onProgress?.(100);
    return existing;
  }
  const operation = (async () => {
    const uploadRef = await uploadPdfDirectly(bytes, onProgress, onConfirm, onConfirmed);
    onRetrieving?.();
    onExtracting?.();
    const response = await fetch("/api/quick-check/pdf-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadRef, filename: input.filename || "document.pdf" }), cache: "no-store" });
    const result = await handleExtractResponse(response, bytes, uploadRef);
    onRunning?.();
    return result;
  })();
  for (const key of cacheKeys) cache.set(key, operation);
  try {
    return await operation;
  } catch (error) {
    for (const key of cacheKeys) if (cache.get(key) === operation) cache.delete(key);
    throw error;
  }
}
async function uploadPdfDirectly(bytes: ArrayBuffer, onProgress?: QuickCheckUploadProgress, onConfirm?: () => void, onConfirmed?: () => void): Promise<string> {
  const presign = await fetch("/api/quick-check/r2-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "presign", size: bytes.byteLength, contentType: "application/pdf" }), cache: "no-store" });
  const data = await presign.json() as { uploadRef?: string; url?: string; error?: string };
  if (!presign.ok || !data.uploadRef || !data.url) throw new Error(data.error ?? "Could not start the PDF upload.");
  await new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("PUT", data.url!); xhr.setRequestHeader("Content-Type", "application/pdf"); xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); }; xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); } else reject(new Error("R2 upload failed. Check CORS configuration and retry.")); }; xhr.onerror = () => reject(new Error("PDF upload was interrupted. Check your connection and retry.")); xhr.send(bytes); });
  onProgress?.(100);
  onConfirm?.();
  const confirmed = await fetch("/api/quick-check/r2-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", uploadRef: data.uploadRef }), cache: "no-store" });
  const result = await confirmed.json().catch(() => ({})) as { error?: string };
  if (!confirmed.ok) throw new Error(result.error ?? "The PDF upload could not be confirmed. Please retry.");
  onConfirmed?.();
  return data.uploadRef;
}
async function handleExtractResponse(response: Response, originalBytes: ArrayBuffer, uploadRef: string): Promise<QuickCheckResolvedPdfText> {
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string; code?: string }; throw new Error(payload.error ?? `PDF extraction failed (${response.status}).`); }
  const payload = await response.json() as { text?: string; engine?: "pdf-parse" | "heuristic"; pages?: QuickCheckPdfPage[]; pdfRef?: string; parserAdapterId?: string; parserFallbackFrom?: string; parserDebug?: QuickCheckPdfParserDebug; metadata?: { parser?: "pdf-parse" | "heuristic"; diagnostics?: { failureKind?: "file-too-large" | "parser-failed" | "no-selectable-text" | "invalid-file" }; } };
  const text = (Array.isArray(payload.pages) && payload.pages.length ? formatQuickCheckPdfPages(payload.pages) : payload.text) ?? "";
  const failureKind = payload.metadata?.diagnostics?.failureKind;
  const engine = payload.engine === "heuristic" || payload.metadata?.parser === "heuristic" ? "heuristic" : "pdf-parse";
  return { text, engine, methodologyMentions: extractMethodologyMentions(text), warning: failureKind === "no-selectable-text" ? "No selectable text found in this PDF." : engine === "heuristic" && text.trim() ? RECOVERED_TEXT_WARNING : undefined, diagnosticCode: failureKind, pdfRef: uploadRef, parserAdapterId: payload.parserDebug?.parserAdapterId ?? payload.parserAdapterId, parserFallbackFrom: payload.parserDebug?.parserFallbackFrom ?? payload.parserFallbackFrom, parserDebug: payload.parserDebug };
}
