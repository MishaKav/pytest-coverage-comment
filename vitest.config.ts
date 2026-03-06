import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['__tests__/setup.ts'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './coverage/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['html', 'json-summary', 'text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts', 'src/types.d.ts', 'src/index.ts'],
    },
  },
});
