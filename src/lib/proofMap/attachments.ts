import type { EvidenceAttachment } from "@/lib/proofMap/types";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import { isSupportedWorkbookUpload, parseWorkbookEvidenceAsset } from "@/lib/evidence/workbook";

const DB_NAME = "article6-proof";
const DB_VERSION = 1;
const STORE_NAME = "attachments";

export const MAX_EVIDENCE_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EVIDENCE_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/geo+json",
  "application/json",
  "application/vnd.google-earth.kml+xml",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/x-zip-compressed",
]);

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable in this environment."));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = run(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
  });
}

export async function putAttachmentBytes(id: string, bytes: ArrayBuffer): Promise<void> {
  await withStore("readwrite", (store) => store.put({ id, bytes }));
}

export async function getAttachmentBytes(id: string): Promise<ArrayBuffer | null> {
  const record = await withStore<{ id: string; bytes: ArrayBuffer } | undefined>("readonly", (store) =>
    store.get(id),
  );
  if (!record) return null;
  return record.bytes;
}

export async function deleteAttachmentBytes(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}_${nowIso()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeMime(file: File): string {
  const mime = (file.type ?? "").trim().toLowerCase();
  if (mime) return mime;
  const lower = (file.name ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".geojson")) return "application/geo+json";
  if (lower.endsWith(".kml")) return "application/vnd.google-earth.kml+xml";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export type EvidenceAttachmentCreateResult =
  | { ok: true; attachment: EvidenceAttachment }
  | { ok: false; message: string };

export async function createAndStoreEvidenceAttachment(input: {
  pin_id: string;
  file: File;
}): Promise<EvidenceAttachmentCreateResult> {
  const file = input.file;
  if (!file) return { ok: false, message: "No file selected." };
  if (file.size > MAX_EVIDENCE_ATTACHMENT_BYTES) {
    return { ok: false, message: `File too large (max ${(MAX_EVIDENCE_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)}MB).` };
  }

  const mime = normalizeMime(file);
  if (!ALLOWED_EVIDENCE_ATTACHMENT_MIME_TYPES.has(mime) && !isSupportedWorkbookUpload({ filename: file.name, mime })) {
    return { ok: false, message: "Unsupported file type (allowed: pdf, docx, xlsx, geojson, kml, shp zip, jpg, png, csv)." };
  }

  const bytes =
    typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function"
      ? await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
      : await new Response(file).arrayBuffer();
  const sha256 = await sha256ArrayBuffer(bytes);
  const workbook_asset = await parseWorkbookEvidenceAsset({
    bytes,
    filename: file.name || "evidence",
    mime,
    fileSha256: sha256,
  });
  const id = newId("att");
  await putAttachmentBytes(id, bytes);

  return {
    ok: true,
    attachment: {
      id,
      pin_id: input.pin_id,
      filename: file.name || "evidence",
      mime,
      size: file.size,
      sha256,
      created_at: nowIso(),
      workbook_asset,
    },
  };
}
