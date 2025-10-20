if (typeof globalThis.fetch !== 'function') {
  throw new Error('[whatwg-fetch-shim] global fetch is not available in this runtime.');
}

export default globalThis.fetch;
