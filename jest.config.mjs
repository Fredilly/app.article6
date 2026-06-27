import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // @vercel/blob uses ESM deps (jose) incompatible with Jest CJS transform
    '^@vercel/blob$': '<rootDir>/tests/mocks/vercel-blob.ts',
    '^@vercel/blob/client$': '<rootDir>/tests/mocks/vercel-blob.ts',
  },
};

export default createJestConfig(customJestConfig);
