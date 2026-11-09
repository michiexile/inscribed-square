import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; local dev and tests use /.
  base: process.env.PAGES_BASE ?? '/',
  test: {
    include: ['src/**/*.test.ts'],
    // Geometry tests run full solves (tens of milliseconds each); CI runners are several times slower than a laptop.
    testTimeout: 30_000,
  },
});
