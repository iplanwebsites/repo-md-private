import { exec } from 'child_process';
import { readdir, access, mkdir } from 'fs/promises';
import { join } from 'path';

export default async function migrateWordPress(exportFile, outputDir = './posts', options = {}) {
  const wpOptions = {
    outputDir,
    exportFile,
    postFolders: options.postFolders !== undefined ? options.postFolders : true,
    prefixDate: options.prefixDate !== undefined ? options.prefixDate : false,
    dateFolders: options.dateFolders || 'none',
    saveImages: options.saveImages || 'all',
    wizard: options.wizard !== undefined ? options.wizard : false,
    frontmatterFields: options.frontmatterFields || 'title,date,categories,tags,coverImage,draft',
    requestDelay: options.requestDelay || 500,
    writeDelay: options.writeDelay || 10,
    timezone: options.timezone || 'utc',
    includeTime: options.includeTime !== undefined ? options.includeTime : false,
    dateFormat: options.dateFormat || '',
    quoteDate: options.quoteDate !== undefined ? options.quoteDate : false,
    strictSsl: options.strictSsl !== undefined ? options.strictSsl : false
  };

  console.log(`Migrating WordPress export: ${exportFile}`);
  console.log(`Output directory: ${outputDir}`);

  try {
    // Validate export file exists
    await access(exportFile);
    console.log(`✅ Export file validated: ${exportFile}`);

    // Create output directory
    try {
      await mkdir(outputDir, { recursive: true });
      console.log(`✅ Output directory created: ${outputDir}`);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Build command
    const command = [
      'npx wordpress-export-to-markdown',
      `--input "${wpOptions.exportFile}"`,
      `--output "${wpOptions.outputDir}"`,
      `--post-folders=${wpOptions.postFolders}`,
      `--prefix-date=${wpOptions.prefixDate}`,
      `--date-folders=${wpOptions.dateFolders}`,
      `--save-images=${wpOptions.saveImages}`,
      `--wizard=${wpOptions.wizard}`,
      `--frontmatter="${wpOptions.frontmatterFields}"`,
      `--request-delay=${wpOptions.requestDelay}`,
      `--throttle=${wpOptions.writeDelay}`,
      `--time-zone=${wpOptions.timezone}`,
      `--include-time=${wpOptions.includeTime}`,
      `--quote-date=${wpOptions.quoteDate}`,
      `--strict-ssl=${wpOptions.strictSsl}`
    ].join(' ');

    console.log('🚀 Starting WordPress migration...');
    console.log(`Command: ${command}`);

    const success = await executeCommand(command);
    
    if (success) {
      // Count created files
      try {
        const files = await readdir(outputDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        console.log(`\n✅ Migration completed: ${mdFiles.length} markdown files created`);
        return { success: true, totalPosts: mdFiles.length, outputDir };
      } catch (err) {
        console.log('✅ Migration completed (could not count files)');
        return { success: true, outputDir };
      }
    } else {
      throw new Error('WordPress migration failed');
    }

  } catch (error) {
    console.error('❌ WordPress migration failed:', error.message);
    throw error;
  }
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const process = exec(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      shell: true
    });

    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log('✅ WordPress conversion completed successfully!');
        resolve(true);
      } else {
        console.error(`❌ Process exited with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}