import migrateRss from './lib/rss/migrator.js';
import migrateWordPress from './lib/wordpress/migrator.js';

export { migrateRss, migrateWordPress };

// Unified migrator function
export async function migrate(type, source, outputDir = './posts', options = {}) {
  switch (type.toLowerCase()) {
    case 'rss':
    case 'atom':
      return migrateRss(source, outputDir, options);
    case 'wordpress':
    case 'wp':
      return migrateWordPress(source, outputDir, options);
    default:
      throw new Error(`Unsupported migration type: ${type}. Supported types: rss, wordpress`);
  }
}

export default migrate;