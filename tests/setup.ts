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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.MessageChannel !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MessageChannel } = require("node:worker_threads") as typeof import("node:worker_threads");
  globalThis.MessageChannel = MessageChannel;
}

if (typeof globalThis.TextEncoder !== "function" || typeof globalThis.TextDecoder !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require("node:util") as typeof import("node:util");
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
