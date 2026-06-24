const APP_VERSION_KEY = "a6:app-version";
const RELOADED_KEY = "a6:app-version:reloaded";
export const QUICK_CHECK_STORAGE_KEY = "a6:quick-check:claim-first:v1";

export function getAppVersion(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }
  return "";
}

export function clearQuickCheckState(): void {
  try {
    localStorage.removeItem(QUICK_CHECK_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

export function storeVersion(version: string): void {
  try {
    localStorage.setItem(APP_VERSION_KEY, version);
  } catch {
    // localStorage may be unavailable
  }
}

export function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(APP_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns `true` when the given version has already triggered a reload
 * in this browser session.  When a newer version appears later the guard
 * will clear and a new reload will be allowed.
 */
export function hasReloaded(version: string): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === version;
  } catch {
    return false;
  }
}

export function markReloaded(version: string): void {
  try {
    sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Checks whether the deployed app version has changed since the user last
 * visited.  When a new deployment is detected:
 *
 *  1. Stale Quick Check local state is cleared.
 *  2. The new version is stored.
 *  3. The page reloads once automatically.
 *
 * Uses a version-scoped sessionStorage guard so that later deployments
 * in the same long-lived browser session still trigger a refresh.
 *
 * Returns `true` if a reload is imminent (the caller should bail out),
 * `false` if no action is needed.
 */
export function detectAppVersionChange(): boolean {
  if (typeof window === "undefined") return false;

  const currentVersion = getAppVersion();
  if (!currentVersion) {
    storeVersion("");
    return false;
  }

  if (hasReloaded(currentVersion)) return false;

  const stored = getStoredVersion();

  if (stored == null) {
    storeVersion(currentVersion);
    return false;
  }

  if (stored !== currentVersion) {
    clearQuickCheckState();
    storeVersion(currentVersion);
    markReloaded(currentVersion);
    window.location.reload();
    return true;
  }

  return false;
}
