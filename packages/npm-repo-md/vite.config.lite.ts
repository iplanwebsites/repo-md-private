import { defineConfig } from 'vite';

// Lite build - externalizes minisearch for smaller bundle
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'RepoMDLite',
      fileName: 'repo-md-lite',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        /^node:.*/,
        'minisearch',  // Externalize for lite bundle
        'zod',
        'zod-metadata'
      ],
      output: {
        exports: 'named',
        globals: {
          'minisearch': 'MiniSearch'
        }
      }
    },
    minify: false,
    sourcemap: false,
    emptyOutDir: false  // Don't clear dist, we're adding to it
  }
});
