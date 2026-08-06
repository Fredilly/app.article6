type OriginPolicyFailureCode =
  | "upload-origin-not-configured"
  | "origin-required"
  | "origin-invalid"
  | "cors-denied";

export type UploadOriginDecision =
  | { allowed: true; normalizedOrigin: string }
  | { allowed: false; code: OriginPolicyFailureCode; status: 403 | 503; error: string };

function environment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function parseOrigin(value: string): URL | undefined {
  try {
    const url = new URL(value.trim());
    if (!url.protocol || !url.hostname || url.username || url.password) return undefined;
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function configuredOrigins(): string[] {
  return (process.env.R2_ALLOWED_UPLOAD_ORIGINS ?? "")
    .split(",")
    .map((value) => parseOrigin(value))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.origin);
}

const APP_ARTICLE6_VERCEL_PREVIEW_HOST = /^app-article6-[a-z0-9-]+-fredillys-projects\.vercel\.app$/i;

function isAppArticle6VercelPreviewOrigin(origin: URL): boolean {
  return environment() === "preview" && origin.protocol === "https:" && origin.hostname.endsWith(".vercel.app") && APP_ARTICLE6_VERCEL_PREVIEW_HOST.test(origin.hostname);
}

export function authorizeQuickCheckUploadOrigin(originHeader: string | null): UploadOriginDecision {
  if (!originHeader) return { allowed: false, code: "origin-required", status: 403, error: "A browser Origin header is required." };
  const origin = parseOrigin(originHeader);
  if (!origin) return { allowed: false, code: "origin-invalid", status: 403, error: "The browser Origin header is invalid." };

  const exactOrigins = configuredOrigins();
  if (exactOrigins.includes(origin.origin) && (environment() !== "production" || origin.protocol === "https:")) return { allowed: true, normalizedOrigin: origin.origin };
  if (isAppArticle6VercelPreviewOrigin(origin)) return { allowed: true, normalizedOrigin: origin.origin };

  if (!exactOrigins.length) return { allowed: false, code: "upload-origin-not-configured", status: 503, error: "Upload origins are not configured. Set R2_ALLOWED_UPLOAD_ORIGINS." };
  return { allowed: false, code: "cors-denied", status: 403, error: "This browser origin is not allowed to upload Quick Check PDFs." };
}
