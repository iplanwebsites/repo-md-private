import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'RepoMD',
      fileName: 'repo-md',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // Don't externalize @repo-md/client - we want it bundled
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
