import { defineConfig } from 'vite';

// Full build - includes everything (minisearch bundled)
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'RepoMD',
      fileName: 'repo-md',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        /^node:.*/
      ],
      output: {
        exports: 'named',
        globals: {}
      }
    },
    minify: false,
    sourcemap: false
  }
});
