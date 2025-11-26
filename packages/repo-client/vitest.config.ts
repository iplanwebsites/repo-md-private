import { defineConfig } from 'vitest/config';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Vite plugin to resolve .js imports to .ts files during TypeScript migration
 * When importing './foo.js', if foo.js doesn't exist but foo.ts does, use foo.ts
 */
function jsToTsPlugin() {
  return {
    name: 'js-to-ts-resolver',
    resolveId(source: string, importer: string | undefined) {
      // Only handle .js imports
      if (!source.endsWith('.js') || !importer) {
        return null;
      }

      // Get the directory of the importing file
      const importerDir = dirname(importer);

      // Resolve the .js path
      const jsPath = resolve(importerDir, source);

      // If .js exists, use it (no change needed)
      if (existsSync(jsPath)) {
        return null;
      }

      // Try .ts version
      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) {
        return tsPath;
      }

      // No match, let Vite handle it
      return null;
    }
  };
}

export default defineConfig({
  plugins: [jsToTsPlugin()],
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.{js,ts}'],
      exclude: ['src/lib/**/*.test.{js,ts}', 'src/lib/archived/**']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
