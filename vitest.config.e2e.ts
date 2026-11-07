import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 180000,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['FE/**', 'dist/**', 'node_modules/**'],
  },
});
