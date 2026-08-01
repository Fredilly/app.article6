import { PutObjectCommand, S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";

const PREFIX = "quick-check/";
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Quick Check R2 storage is not configured.");
  return { bucket, client: new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }) };
}
export function makeUploadReference() { return randomUUID(); }
export function objectKey(reference: string) { return `${PREFIX}${reference}`; }
export async function presignQuickCheckUpload(input: { reference: string }) {
  const { bucket, client } = config();
  const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: objectKey(input.reference), ContentType: "application/pdf" }), { expiresIn: 300 });
  return { url, expiresIn: 300 };
}
export async function confirmQuickCheckUpload(input: { reference: string; size: number }) {
  const { bucket, client } = config();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey(input.reference) }));
  const actualSize = head.ContentLength;
  if (actualSize === undefined || actualSize !== input.size || head.ContentType?.toLowerCase() !== "application/pdf") throw new Error("Uploaded PDF metadata did not match the requested upload.");
  return { uploadRef: input.reference, size: actualSize };
}
export { MAX_QUICK_CHECK_PDF_BYTES };
