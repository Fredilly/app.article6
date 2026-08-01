import { extractMethodologyMentions, extractPdfText, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";
import { isLikelyPdfBytes, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";

export type QuickCheckUploadProgress = (percent: number) => void;

export async function resolveQuickCheckPdfText(input: { bytes: ArrayBuffer; filename: string; onProgress?: QuickCheckUploadProgress }): Promise<QuickCheckResolvedPdfText> {
  const { bytes, onProgress } = input;
  if (bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES) throw new Error("PDF exceeds the Quick Check upload limit of 50MB.");
  if (!isLikelyPdfBytes(bytes)) throw new Error("Only valid PDF files can be uploaded.");
  const uploadRef = await uploadPdfDirectly(bytes, onProgress);
  const text = extractPdfText(bytes);
  return { text, engine: "heuristic", methodologyMentions: extractMethodologyMentions(text), pdfRef: uploadRef };
}

async function uploadPdfDirectly(bytes: ArrayBuffer, onProgress?: QuickCheckUploadProgress): Promise<string> {
  const presign = await fetch("/api/quick-check/r2-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "presign", size: bytes.byteLength, contentType: "application/pdf" }), cache: "no-store" });
  const data = await presign.json() as { uploadRef?: string; url?: string; error?: string };
  if (!presign.ok || !data.uploadRef || !data.url) throw new Error(data.error ?? "Could not start the PDF upload.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.url!);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("R2 upload failed. Check CORS configuration and retry."));
    xhr.onerror = () => reject(new Error("PDF upload was interrupted. Check your connection and retry."));
    xhr.send(bytes);
  });
  const confirmed = await fetch("/api/quick-check/r2-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", uploadRef: data.uploadRef, size: bytes.byteLength }), cache: "no-store" });
  if (!confirmed.ok) throw new Error("The PDF upload could not be confirmed. Please retry.");
  return data.uploadRef;
}
