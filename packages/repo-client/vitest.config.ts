import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/**/*.test.js', 'src/lib/archived/**']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
