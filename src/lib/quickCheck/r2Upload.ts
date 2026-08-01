import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";

const PREFIX = "quick-check/";
const REFERENCE_TTL_SECONDS = 600;
const PRESIGNED_URL_TTL_SECONDS = 300;
export type UploadErrorCode = "storage-not-configured" | "upload-reference-invalid" | "upload-reference-expired" | "upload-environment-mismatch" | "upload-not-found" | "upload-too-large" | "upload-unsupported-content-type" | "upload-metadata-mismatch" | "storage-unavailable";
export class QuickCheckUploadError extends Error { constructor(public readonly code: UploadErrorCode, message: string) { super(message); } }
type Claims = { objectId: string; expectedSize: number; contentType: "application/pdf"; environment: string; issuedAt: number; expiresAt: number };
function envName() { return process.env.VERCEL_ENV || process.env.NODE_ENV || "development"; }
function secret() { const value = process.env.QUICK_CHECK_UPLOAD_SIGNING_SECRET; if (!value) throw new QuickCheckUploadError("storage-not-configured", "Quick Check upload signing is not configured."); return value; }
function config() {
  const accountId = process.env.R2_ACCOUNT_ID, bucket = process.env.R2_BUCKET_NAME, accessKeyId = process.env.R2_ACCESS_KEY_ID, secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new QuickCheckUploadError("storage-not-configured", "Quick Check R2 storage is not configured.");
  return { bucket, client: new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }) };
}
const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
export function issueUploadReference(expectedSize: number) {
  const now = Math.floor(Date.now() / 1000);
  const claims: Claims = { objectId: randomUUID(), expectedSize, contentType: "application/pdf", environment: envName(), issuedAt: now, expiresAt: now + REFERENCE_TTL_SECONDS };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}
export function verifyUploadReference(reference: string): Claims {
  try {
    const [payload, signature] = reference.split(".");
    if (!payload || !signature || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) throw new Error();
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
    const claims = JSON.parse(decode(payload)) as Claims;
    if (claims.contentType !== "application/pdf" || !Number.isInteger(claims.expectedSize) || claims.expectedSize <= 0 || claims.expectedSize > MAX_QUICK_CHECK_PDF_BYTES || typeof claims.objectId !== "string") throw new Error();
    if (claims.environment !== envName()) throw new QuickCheckUploadError("upload-environment-mismatch", "This upload reference belongs to a different environment.");
    if (!Number.isInteger(claims.issuedAt) || !Number.isInteger(claims.expiresAt) || claims.expiresAt <= Math.floor(Date.now() / 1000)) throw new QuickCheckUploadError("upload-reference-expired", "The upload reference has expired.");
    return claims;
  } catch (error) {
    if (error instanceof QuickCheckUploadError) throw error;
    throw new QuickCheckUploadError("upload-reference-invalid", "The upload reference is invalid.");
  }
}
function objectKey(claims: Claims) { return `${PREFIX}${claims.environment}/${claims.objectId}`; }
export async function presignQuickCheckUpload(expectedSize: number) {
  const uploadRef = issueUploadReference(expectedSize);
  const claims = verifyUploadReference(uploadRef);
  const { bucket, client } = config();
  const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: objectKey(claims), ContentType: claims.contentType }), { expiresIn: PRESIGNED_URL_TTL_SECONDS });
  return { uploadRef, url, expiresIn: PRESIGNED_URL_TTL_SECONDS };
}
export async function confirmQuickCheckUpload(reference: string) {
  const claims = verifyUploadReference(reference);
  const { bucket, client } = config();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey(claims) }));
    const actualSize = head.ContentLength;
    if (actualSize !== undefined && actualSize > MAX_QUICK_CHECK_PDF_BYTES) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(claims) })).catch(() => undefined);
      throw new QuickCheckUploadError("upload-too-large", "The uploaded PDF exceeds the Quick Check upload limit.");
    }
    if (actualSize === undefined || actualSize <= 0 || actualSize !== claims.expectedSize || head.ContentType?.toLowerCase() !== claims.contentType) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(claims) })).catch(() => undefined);
      throw new QuickCheckUploadError("upload-metadata-mismatch", "The uploaded PDF metadata did not match the requested upload.");
    }
    return { uploadRef: reference, size: actualSize };
  } catch (error) {
    if (error instanceof QuickCheckUploadError) throw error;
    if ((error as { name?: string }).name === "NotFound" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) throw new QuickCheckUploadError("upload-not-found", "The uploaded PDF was not found.");
    throw new QuickCheckUploadError("storage-unavailable", "Upload storage is temporarily unavailable.");
  }
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (body && typeof body === "object" && "transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Resolve and retrieve an upload without exposing the bucket or server-only object key. */
export async function retrieveQuickCheckUpload(reference: string): Promise<{ bytes: ArrayBuffer; size: number }> {
  const claims = verifyUploadReference(reference);
  const { bucket, client } = config();
  const key = objectKey(claims);
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const size = head.ContentLength;
    const contentType = head.ContentType?.toLowerCase();
    if (size === undefined || size <= 0) throw new QuickCheckUploadError("upload-not-found", "The uploaded PDF was not found.");
    if (size > MAX_QUICK_CHECK_PDF_BYTES) throw new QuickCheckUploadError("upload-too-large", "The uploaded PDF exceeds the Quick Check upload limit.");
    if (size !== claims.expectedSize) throw new QuickCheckUploadError("upload-metadata-mismatch", "The uploaded PDF metadata did not match the upload reference.");
    if (contentType !== claims.contentType) throw new QuickCheckUploadError("upload-unsupported-content-type", "The uploaded object is not a PDF.");

    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (object.ContentLength !== undefined && object.ContentLength !== size) throw new QuickCheckUploadError("upload-metadata-mismatch", "The uploaded PDF metadata did not match the upload reference.");
    if (object.ContentType && object.ContentType.toLowerCase() !== claims.contentType) throw new QuickCheckUploadError("upload-unsupported-content-type", "The uploaded object is not a PDF.");
    if (!object.Body) throw new QuickCheckUploadError("storage-unavailable", "The uploaded PDF could not be retrieved.");
    const bytes = await bodyToBuffer(object.Body);
    if (bytes.length !== size) throw new QuickCheckUploadError("upload-metadata-mismatch", "The uploaded PDF metadata did not match the upload reference.");
    return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, size };
  } catch (error) {
    if (error instanceof QuickCheckUploadError) throw error;
    if ((error as { name?: string }).name === "NotFound" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) throw new QuickCheckUploadError("upload-not-found", "The uploaded PDF was not found.");
    throw new QuickCheckUploadError("storage-unavailable", "Upload storage is temporarily unavailable.");
  }
}
export { MAX_QUICK_CHECK_PDF_BYTES };
