import { getAttachmentBytes } from "@/lib/proofMap/attachments";
import type { EvidenceAttachment } from "@/lib/proofMap/types";

const PENDING_QUICK_CHECK_HANDOFF_KEY = "article6:pending-quick-check-project-handoff";

export type PendingQuickCheckProjectHandoff = {
  projectName: string;
  methodCode?: string;
  methodVersion?: string;
  reportingPeriod?: string;
  aoiLabel?: string;
  description?: string;
  sourceDocument: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    contentSha256?: string;
    contentBase64?: string;
    extractedText?: string;
  };
  createdAt: string;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function stagePendingQuickCheckProjectHandoff(input: {
  projectName: string;
  methodCode?: string;
  methodVersion?: string;
  reportingPeriod?: string;
  aoiLabel?: string;
  description?: string;
  extractedText?: string;
  attachment: EvidenceAttachment;
}): Promise<PendingQuickCheckProjectHandoff> {
  const bytes = await getAttachmentBytes(input.attachment.id);
  const handoff: PendingQuickCheckProjectHandoff = {
    projectName: input.projectName,
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
    reportingPeriod: input.reportingPeriod,
    aoiLabel: input.aoiLabel,
    description: input.description,
    sourceDocument: {
      fileName: input.attachment.filename,
      mimeType: input.attachment.mime,
      sizeBytes: input.attachment.size,
      contentSha256: input.attachment.sha256,
      contentBase64: bytes ? arrayBufferToBase64(bytes) : undefined,
      extractedText: input.extractedText,
    },
    createdAt: new Date().toISOString(),
  };

  getStorage()?.setItem(PENDING_QUICK_CHECK_HANDOFF_KEY, JSON.stringify(handoff));
  return handoff;
}

export function readPendingQuickCheckProjectHandoff(): PendingQuickCheckProjectHandoff | null {
  const raw = getStorage()?.getItem(PENDING_QUICK_CHECK_HANDOFF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingQuickCheckProjectHandoff;
    if (!parsed?.projectName || !parsed?.sourceDocument?.fileName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingQuickCheckProjectHandoff(): void {
  getStorage()?.removeItem(PENDING_QUICK_CHECK_HANDOFF_KEY);
}
