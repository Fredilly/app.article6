import type { QuickCheckDraft, QuickCheckStagedUpload } from "@/lib/chat/quickCheck";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";
import type { EvidenceAttachment } from "@/lib/proofMap/types";

export const QUICK_CHECK_DEMO = {
  claimText: "The monitoring report covers the full reporting period.",
  methodologyId: "AR-ACM0003",
  methodologyVersion: "v02-0",
  requirementId: "R-1-0001",
  requirementLabel: "R-1-0001 · Monitoring frequency",
  evidenceId: "demo-monitoring-report",
  attachmentId: "att-demo-monitoring-report",
  filename: "demo-monitoring-report.pdf",
  mime: "application/pdf",
  createdAt: "2026-04-05T00:00:00Z",
  sha256: "sha-demo-monitoring-report",
  pdfText: "%PDF-1.4\n(Monitoring report for the full reporting period.)\n%%EOF",
} as const;

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return new Uint8Array(value).buffer.slice(0);
}

export async function prepareQuickCheckDemo(): Promise<{
  draft: QuickCheckDraft;
  stagedUpload: QuickCheckStagedUpload;
}> {
  const bytes = new TextEncoder().encode(QUICK_CHECK_DEMO.pdfText);
  await putAttachmentBytes(QUICK_CHECK_DEMO.attachmentId, asArrayBuffer(bytes));

  const attachment: EvidenceAttachment = {
    id: QUICK_CHECK_DEMO.attachmentId,
    pin_id: QUICK_CHECK_DEMO.evidenceId,
    filename: QUICK_CHECK_DEMO.filename,
    mime: QUICK_CHECK_DEMO.mime,
    size: bytes.byteLength,
    sha256: QUICK_CHECK_DEMO.sha256,
    created_at: QUICK_CHECK_DEMO.createdAt,
  };

  return {
    draft: {
      id: "quick-check-demo",
      claimText: QUICK_CHECK_DEMO.claimText,
      methodologyId: QUICK_CHECK_DEMO.methodologyId,
      methodologyVersion: QUICK_CHECK_DEMO.methodologyVersion,
      evidenceIds: [QUICK_CHECK_DEMO.evidenceId],
      status: "draft",
      createdAt: QUICK_CHECK_DEMO.createdAt,
      updatedAt: QUICK_CHECK_DEMO.createdAt,
    },
    stagedUpload: {
      evidenceId: QUICK_CHECK_DEMO.evidenceId,
      filename: QUICK_CHECK_DEMO.filename,
      mime: QUICK_CHECK_DEMO.mime,
      createdAt: QUICK_CHECK_DEMO.createdAt,
      attachment,
    },
  };
}
