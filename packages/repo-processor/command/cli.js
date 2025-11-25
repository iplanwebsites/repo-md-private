#!/usr/bin/env node

// cli.js
import { Command } from "commander";
import path from "path";

import { RepoProcessor, jsonStringify, writeToFileSync } from "../dist/index.js";

const program = new Command();

program
  .name("obsidian-to-json")
  .description("Convert Obsidian vault to JSON")
  .version("1.0.0")
  .requiredOption("-i, --input <path>", "Input directory path (Obsidian vault)")
  .option("-o, --output <path>", "Output JSON file path", "vault-output.json")
  .option("-n, --note-prefix <prefix>", "Note path prefix", "/notes")
  .option("-a, --asset-prefix <prefix>", "Asset path prefix", "/assets")
  .option("-d, --debug <level>", "Debug level (0-3)", "1")
  // Add media processing options
  .option("--media-output <path>", "Media output folder path", "public/media")
  .option("--media-prefix <prefix>", "Media path prefix", "/media")
  .option("--optimize-images", "Optimize images", true)
  .option("--skip-media", "Skip media processing", false)
  .option("--skip-existing", "Skip processing existing media files", false)
  .option(
    "--force-reprocess-medias",
    "Force reprocessing of media files even if they exist",
    false
  )
  .option("--domain <url>", "Domain for absolute public paths")
  .option(
    "--use-absolute-paths",
    "Use absolute paths with domain for media replacements in articles",
    true
  )
  .option(
    "--media-results <path>",
    "Save media processing results to a JSON file",
    "media-results.json"
  )
  .parse(process.argv);

const options = program.opts();

// Self-invoking async function to allow top-level await
(async () => {
  try {
    const debugLevel = parseInt(options.debug);

    console.log(`🚀 Starting Obsidian vault conversion`);

    // Create config object for the process function
    const config = {
      inputPath: options.input,
      outputPath: options.output,
      notePathPrefix: options.notePrefix,
      assetPathPrefix: options.assetPrefix,
      debugLevel,
      mediaOutputFolder: options.mediaOutput,
      mediaPathPrefix: options.mediaPrefix,
      optimizeImages: options.optimizeImages,
      skipMedia: options.skipMedia,
      skipExisting: options.skipExisting,
      forceReprocessMedias: options.forceReprocessMedias,
      domain: options.domain,
      useAbsolutePaths: options.useAbsolutePaths,
      mediaResultsPath: options.mediaResults,
    };

    // Process the vault with the RepoProcessor
    const processor = new RepoProcessor(config);
    const result = await processor.process();

    console.log(`✨ Successfully processed ${result.vaultData.length} files`);
    console.log(
      `📝 Output saved to: ${path.resolve(process.cwd(), options.output)}`
    );

    if (!options.skipMedia) {
      console.log(`✅ Processed ${result.mediaData.length} media files`);
      console.log(
        `📝 Media results saved to: ${path.resolve(process.cwd(), options.mediaResults)}`
      );
    }
  } catch (error) {
    console.error(`❌ Error processing vault: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
})();

// Usage examples:
// npm run convert -- -i test/testVault1 -o testOutput.json
// npm run convert -- -i test/testVault1 -o testOutput.json --media-output public/assets --media-prefix /assets
// npm run convert -- -i test/testVault1 -o testOutput.json --skip-media
// npm run convert -- -i test/testVault1 -o testOutput.json --skip-existing
// npm run convert -- -i test/testVault1 -o testOutput.json --force-reprocess-medias
// npm run convert -- -i test/testVault1 -o testOutput.json --media-results media-data.json
// npm run convert -- -i test/testVault1 -o testOutput.json --domain https://example.com
