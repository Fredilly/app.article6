/** @jest-environment jsdom */

import {
  clearQuickCheckState,
  detectAppVersionChange,
  getAppVersion,
  getStoredVersion,
  hasReloaded,
  markReloaded,
  QUICK_CHECK_STORAGE_KEY,
  storeVersion,
} from "@/lib/appVersion";

const TEST_VERSION = "0.1.0+abc1234";
const TEST_VERSION_2 = "0.1.0+def5678";

function setAppVersion(value: string) {
  (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_VERSION = value;
}

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: jest.fn((key: string) => { data.delete(key); }),
  };
}

beforeEach(() => {
  // @ts-expect-error: jsdom window mocks
  delete window.location;
  // @ts-expect-error: jsdom window mocks
  window.location = { reload: jest.fn() };

  const localStorageMock = makeStorage();
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });

  const sessionStorageMock = makeStorage();
  Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock, writable: true });
});

describe("getAppVersion", () => {
  it("returns the NEXT_PUBLIC_APP_VERSION env var", () => {
    setAppVersion(TEST_VERSION);
    expect(getAppVersion()).toBe(TEST_VERSION);
  });

  it("returns empty string when not set", () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_VERSION;
    expect(getAppVersion()).toBe("");
  });
});

describe("storeVersion / getStoredVersion", () => {
  it("stores and retrieves a version", () => {
    storeVersion(TEST_VERSION);
    expect(getStoredVersion()).toBe(TEST_VERSION);
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredVersion()).toBeNull();
  });
});

describe("hasReloaded / markReloaded", () => {
  it("returns true only for the exact version that was marked", () => {
    expect(hasReloaded(TEST_VERSION)).toBe(false);

    markReloaded(TEST_VERSION);
    expect(hasReloaded(TEST_VERSION)).toBe(true);
    expect(hasReloaded(TEST_VERSION_2)).toBe(false);
  });
});

describe("clearQuickCheckState", () => {
  it("removes the Quick Check localStorage key", () => {
    localStorage.setItem(QUICK_CHECK_STORAGE_KEY, "stale-data");
    clearQuickCheckState();
    expect(localStorage.getItem(QUICK_CHECK_STORAGE_KEY)).toBeNull();
  });
});

describe("detectAppVersionChange", () => {
  it("first visit stores current version and does not reload", () => {
    setAppVersion(TEST_VERSION);

    const result = detectAppVersionChange();

    expect(result).toBe(false);
    expect(getStoredVersion()).toBe(TEST_VERSION);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("version change clears Quick Check state and reloads once", () => {
    setAppVersion(TEST_VERSION);
    storeVersion(TEST_VERSION_2); // simulate prior deploy
    localStorage.setItem(QUICK_CHECK_STORAGE_KEY, "stale-data");

    const result = detectAppVersionChange();

    expect(result).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(getStoredVersion()).toBe(TEST_VERSION);
    expect(localStorage.getItem(QUICK_CHECK_STORAGE_KEY)).toBeNull();
  });

  it("same version does not reload repeatedly", () => {
    setAppVersion(TEST_VERSION);
    storeVersion(TEST_VERSION);

    const result = detectAppVersionChange();

    expect(result).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("second version change in same session still reloads", () => {
    setAppVersion(TEST_VERSION_2);
    storeVersion(TEST_VERSION); // prior deploy
    markReloaded(TEST_VERSION); // simulates having already reloaded for the prior version

    const result = detectAppVersionChange();

    // The guard only suppresses for TEST_VERSION, not TEST_VERSION_2
    expect(result).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(getStoredVersion()).toBe(TEST_VERSION_2);
  });

  it("does not reload again for same version after one reload", () => {
    setAppVersion(TEST_VERSION);
    storeVersion(TEST_VERSION_2); // prior
    const first = detectAppVersionChange();
    expect(first).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    // Simulate the reload — the guard is now set for TEST_VERSION
    markReloaded(TEST_VERSION);
    storeVersion(TEST_VERSION);

    // Second call should be suppressed
    const second = detectAppVersionChange();
    expect(second).toBe(false);
  });

  it("returns false server-side (no window)", () => {
    // @ts-expect-error: testing SSR path
    const backup = global.window;
    // @ts-expect-error: testing SSR path
    delete global.window;
    try {
      expect(detectAppVersionChange()).toBe(false);
    } finally {
      // @ts-expect-error: testing SSR path
      global.window = backup;
    }
  });

  it("stores empty version when NEXT_PUBLIC_APP_VERSION is unset", () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_APP_VERSION;
    storeVersion(TEST_VERSION_2); // prior

    const result = detectAppVersionChange();

    // Should not reload when there's no current version
    expect(result).toBe(false);
    expect(getStoredVersion()).toBe("");
  });
});
