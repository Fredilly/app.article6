export type PrimaryNavKey = "start-review" | "projects" | "methods" | null;

function trimTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getPrimaryNavKey(pathname: string | null | undefined): PrimaryNavKey {
  const normalized = trimTrailingSlash(pathname ?? "/");

  if (normalized === "/start-review") return "start-review";
  if (normalized === "/methods") return "methods";
  if (normalized === "/projects") return "projects";
  if (normalized.startsWith("/projects/")) {
    const remainder = normalized.slice("/projects/".length);
    if (remainder === "new") return null;
    if (remainder.length > 0 && !remainder.includes("/")) return "projects";
  }

  return null;
}
