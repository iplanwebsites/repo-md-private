// test-wp-importer.js
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import WpImporter from "../src/lib/wpImporter.js";

/**
 * Tests the WP Importer functionality with a sample export file
 */

const TEST_EXPORT_FILE = "wp1.xml"; //"wp1.xml"

// docs: https://github.com/repo-md/wordpress-to-md

async function testWpImporter() {
  try {
    // Define test parameters
    const testDir = path.join(process.cwd(), "test-wp-import");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const sampleExportFile = path.join(__dirname, TEST_EXPORT_FILE);

    // Check if test file exists
    try {
      await fs.access(sampleExportFile);
    } catch (error) {
      console.error(`❌ Error: Test file not found at ${sampleExportFile}`);
      console.error(
        "Please place a WordPress export file named 'sample-wp-export.xml' in the scripts folder"
      );
      process.exit(1);
    }

    console.log(`🧪 Testing WP Importer with export file: ${sampleExportFile}`);

    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    console.log(`📁 Created test directory: ${testDir}`);

    // Initialize the importer with test configuration
    const importer = new WpImporter({
      outputDir: testDir,
      exportFile: sampleExportFile,
      //postFolders: true,
      //prefixDate: true,
      saveImages: "all",
      //  frontmatterFields:    "title,date,categories,tags,coverImage,draft,featured_image,meta,permalink,status",
      //requestDelay: 500,
      //writeDelay: 10,
      //timezone: "local",
      //includeTime: true,
      //quoteDate: true,
      // dateFolders: "year",
      //wizard: false,
    });

    console.log("⚙️ WP Importer configured with test settings");

    // Run the import process
    console.log("🔄 Starting import process...");
    const result = await importer.import();

    if (result) {
      console.log("✅ Import completed successfully!");
      console.log(`📂 Imported content is available in: ${testDir}`);

      // List the files created
      const files = await fs.readdir(testDir, { withFileTypes: true });
      console.log("\n📑 Generated files and directories:");
      for (const file of files) {
        console.log(`  ${file.isDirectory() ? "📁" : "📄"} ${file.name}`);
      }
    } else {
      console.error("❌ Import failed");
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

// Run the test
testWpImporter();
