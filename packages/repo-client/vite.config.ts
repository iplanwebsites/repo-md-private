import packageJson from './package.json';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create aliases for all dependencies to resolve from hoisted root node_modules
const depAliases = Object.keys(packageJson.dependencies || {}).reduce((acc, dep) => {
  acc[dep] = path.resolve(__dirname, '../../node_modules', dep);
  return acc;
}, {});

export default {
  resolve: {
    alias: depAliases
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