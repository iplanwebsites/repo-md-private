import packageJson from './package.json';

// For library builds, externalize all dependencies - consumers will provide them
// Use regex to match package and all subpaths (e.g., 'zod-metadata' and 'zod-metadata/register')
const deps = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
];
const external = [
  ...deps.map(dep => new RegExp(`^${dep}(/.*)?$`)),
  /^node:.*/  // Also externalize node: imports
];

export default {
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_APP_BUILD_DATE': JSON.stringify(new Date().toISOString()),
  },
  build: {
    lib: {
      entry: 'src/lib/index.ts',
      name: 'RepoMD',
      fileName: 'repo-md'
    },
    rollupOptions: {
      external,
      output: {
        exports: 'named',
        // Global variable names for UMD build
        globals: {
          'quick-lru': 'QuickLRU',
          'envizion': 'envizion',
          'compute-cosine-similarity': 'computeCosineSimilarity',
          'minisearch': 'MiniSearch',
          'zod': 'zod',
          'zod-metadata': 'zodMetadata',
          'zod-metadata/register': 'zodMetadataRegister'
        }
      }
    },
    // Disable minification for standard builds - the minified version will be created separately
    minify: false
  }
};