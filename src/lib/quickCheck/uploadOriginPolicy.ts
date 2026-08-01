type OriginPolicyFailureCode =
  | "upload-origin-not-configured"
  | "preview-origin-policy-not-configured"
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

function previewHostnamePolicy(): { prefix: string; suffix: string } | undefined {
  const prefix = process.env.R2_ALLOWED_PREVIEW_PROJECT_PREFIX?.trim();
  const suffix = process.env.R2_ALLOWED_PREVIEW_TEAM_SUFFIX?.trim().toLowerCase();
  if (!prefix || !suffix || suffix.length <= ".vercel.app".length || !suffix.endsWith(".vercel.app")) return undefined;
  return { prefix, suffix };
}

export function authorizeQuickCheckUploadOrigin(originHeader: string | null): UploadOriginDecision {
  if (!originHeader) return { allowed: false, code: "origin-required", status: 403, error: "A browser Origin header is required." };
  const origin = parseOrigin(originHeader);
  if (!origin) return { allowed: false, code: "origin-invalid", status: 403, error: "The browser Origin header is invalid." };

  const exactOrigins = configuredOrigins();
  if (exactOrigins.includes(origin.origin) && (environment() !== "production" || origin.protocol === "https:")) return { allowed: true, normalizedOrigin: origin.origin };

  if (environment() !== "preview") {
    if (environment() === "production" && !exactOrigins.some((value) => value.startsWith("https://"))) {
      return { allowed: false, code: "upload-origin-not-configured", status: 503, error: "HTTPS upload origins are not configured for Production." };
    }
    return { allowed: false, code: exactOrigins.length ? "cors-denied" : "upload-origin-not-configured", status: exactOrigins.length ? 403 : 503, error: exactOrigins.length ? "This browser origin is not allowed to upload Quick Check PDFs." : "Upload origins are not configured." };
  }

  const policy = previewHostnamePolicy();
  if (!policy) return { allowed: false, code: "preview-origin-policy-not-configured", status: 503, error: "Preview upload origin policy is not configured. Set R2_ALLOWED_PREVIEW_PROJECT_PREFIX and R2_ALLOWED_PREVIEW_TEAM_SUFFIX." };
  const hostname = origin.hostname.toLowerCase();
  if (origin.protocol === "https:" && !origin.port && hostname.startsWith(policy.prefix.toLowerCase()) && hostname.endsWith(policy.suffix)) {
    return { allowed: true, normalizedOrigin: origin.origin };
  }
  return { allowed: false, code: "cors-denied", status: 403, error: "This browser origin is not allowed to upload Quick Check PDFs." };
}
