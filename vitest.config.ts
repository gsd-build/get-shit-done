import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'apps/server/src/**/*.ts',
        'packages/gsd-wrapper/src/**/*.ts',
        'packages/events/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/types.ts',
        '**/index.ts',
      ],
    },
  },
});
