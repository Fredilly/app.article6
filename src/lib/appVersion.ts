const APP_VERSION_KEY = "a6:app-version";
const RELOADED_KEY = "a6:app-version:reloaded";
const QUICK_CHECK_STORAGE_KEY = "a6:quick-check:claim-first:v1";

export function getAppVersion(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }
  return "";
}

function clearQuickCheckState(): void {
  try {
    localStorage.removeItem(QUICK_CHECK_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

function storeVersion(version: string): void {
  try {
    localStorage.setItem(APP_VERSION_KEY, version);
  } catch {
    // localStorage may be unavailable
  }
}

function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(APP_VERSION_KEY);
  } catch {
    return null;
  }
}

function hasReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === "1";
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOADED_KEY, "1");
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
 * Uses sessionStorage to prevent infinite reload loops.
 *
 * Returns `true` if a reload is imminent (the caller should bail out),
 * `false` if no action is needed.
 */
export function detectAppVersionChange(): boolean {
  if (typeof window === "undefined") return false;

  if (hasReloaded()) return false;

  const currentVersion = getAppVersion();
  if (!currentVersion) {
    storeVersion("");
    return false;
  }

  const stored = getStoredVersion();

  if (stored == null) {
    storeVersion(currentVersion);
    return false;
  }

  if (stored !== currentVersion) {
    clearQuickCheckState();
    storeVersion(currentVersion);
    markReloaded();
    window.location.reload();
    return true;
  }

  return false;
}
