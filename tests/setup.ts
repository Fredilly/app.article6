// Polyfill fetch for tests that render client components
import 'whatwg-fetch';

// fake-indexeddb expects structuredClone in some environments
if (typeof globalThis.structuredClone !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const v8 = require("node:v8") as typeof import("node:v8");
  globalThis.structuredClone = (value: unknown) => v8.deserialize(v8.serialize(value));
}

// IndexedDB polyfill for zip/attachment tests (after structuredClone polyfill)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("fake-indexeddb/auto");
