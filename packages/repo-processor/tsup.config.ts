import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Bundle @wordpress/wordcount to avoid ESM resolution issues
  noExternal: ['@wordpress/wordcount'],
});
