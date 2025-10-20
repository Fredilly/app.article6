import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const {
  describe,
  test,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi
} = globalThis;

if (!vi || !describe || !expect) {
  throw new Error('[jest-globals-shim] Vitest globals are unavailable. Ensure the tests run via Vitest.');
}

function resolveManualMock(moduleName) {
  const normalized = moduleName.startsWith('@/')
    ? moduleName.slice(2)
    : moduleName.startsWith('./')
      ? moduleName.slice(2)
      : moduleName.replace(/^\//, '');

  const inferredModulePath = path.join(
    process.cwd(),
    normalized.startsWith('src/') ? normalized : path.join('src', normalized)
  );
  const inferredBaseName = path.basename(normalized);

  const searchBases = [
    path.join(process.cwd(), '__mocks__', normalized),
    path.join(process.cwd(), '__mocks__', moduleName),
    path.join(path.dirname(inferredModulePath), '__mocks__', inferredBaseName)
  ];

  const candidates = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const basePath of searchBases) {
    for (const ext of candidates) {
      const candidate = basePath.endsWith(ext) ? basePath : basePath + ext;
      if (fs.existsSync(candidate)) {
        const fileUrl = pathToFileURL(candidate).href;
        return async () => import(fileUrl);
      }
    }
  }
  return null;
}

const jestShim = {
  fn: (...args) => vi.fn(...args),
  spyOn: (...args) => vi.spyOn(...args),
  mock: (moduleName, factory, options) => {
    if (factory) {
      return vi.mock(moduleName, factory, options);
    }
    const manualFactory = resolveManualMock(moduleName);
    if (manualFactory) {
      return vi.mock(moduleName, manualFactory, options);
    }
    return vi.mock(moduleName, undefined, options);
  },
  unmock: (...args) => vi.unmock(...args),
  clearAllMocks: () => vi.clearAllMocks(),
  resetAllMocks: () => vi.resetAllMocks(),
  restoreAllMocks: () => vi.restoreAllMocks()
};

if (!globalThis.jest) {
  globalThis.jest = jestShim;
}

export { describe, test, it, expect, beforeAll, beforeEach, afterAll, afterEach, jestShim as jest };
export default {
  describe,
  test,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  jest: jestShim
};
