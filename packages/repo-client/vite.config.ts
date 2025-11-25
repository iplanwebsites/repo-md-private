import packageJson from './package.json';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  resolve: {
    alias: {
      // Help resolve packages from hoisted root node_modules
      'envizion': path.resolve(__dirname, '../../node_modules/envizion')
    }
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_APP_BUILD_DATE': JSON.stringify(new Date().toISOString()),
  },
  build: {
    lib: {
      entry: 'src/lib/index.js',
      name: 'RepoMD',
      fileName: 'repo-md'
    },
    rollupOptions: {
      external: ['quick-lru'],
      output: {
        exports: 'named',
        globals: {
          'quick-lru': 'QuickLRU'
        }
      }
    },
    // Disable minification for standard builds - the minified version will be created separately
    minify: false
  }
};