export const AUDIT_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUDIT === "true";
export const ALWAYS_SHOW_HEALTH = (process.env.NEXT_PUBLIC_ALWAYS_SHOW_HEALTH ?? "1") === "1";
export const TICKETS_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TICKETS === "true";
