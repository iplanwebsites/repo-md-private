import dotenv from "dotenv";
import Airtable from "airtable";
import crypto from "crypto-js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Initialize environment variables
dotenv.config();

// Get the directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Constants
const AIRTABLE_BASE_ID = "appR09NtKNzotLCl5";
const DATA_DIR = path.join(path.dirname(__dirname), "data");
const SALT = "rndTextNotguessable42353467";

// Configuration for different tables and views
const SYNC_CONFIG = [
  {
    tableName: "activities",
    view: "api",
    outputFile: "activities.json",
    processRecord: (record) => ({
      ...record.fields,
      airtableId: record.id,
      sha: base64hash(
        crypto.SHA256((record.fields.slug || "") + SALT + record.id)
      ),
    }),
  },
  {
    tableName: "emailTemplates",
    view: "api",
    outputFile: "emailTemplates.json",
    processRecord: (record) => ({
      ...record.fields,
      airtableId: record.id,
      sha: base64hash(
        crypto.SHA256((record.fields.name || "") + SALT + record.id)
      ),
    }),
  },
  {
    tableName: "extraConfigs",
    view: "api",
    outputFile: "extraConfigs.json",
    processRecord: (record) => ({
      ...record.fields,
      airtableId: record.id,
      sha: base64hash(
        crypto.SHA256((record.fields.id || "") + SALT + record.id)
      ),
    }),
  },
];

// Environment validation
if (!process.env.AIRTABLE_TOKEN) {
  console.error("Error: AIRTABLE_TOKEN environment variable is missing");
  console.error("Please create a .env file in the project root with:");
  console.error("AIRTABLE_TOKEN=your_token_here");
  process.exit(1);
}

// Initialize Airtable with error handling
let base;
try {
  base = new Airtable({
    apiKey: process.env.AIRTABLE_TOKEN,
  }).base(AIRTABLE_BASE_ID);
} catch (error) {
  console.error("Failed to initialize Airtable client:", error);
  process.exit(1);
}

/**
 * Generates a base64 hash from a crypto-js hash digest
 * @param {CryptoJS.lib.WordArray} hashDigest - The hash digest to convert
 * @returns {string} Base64 encoded hash
 */
function base64hash(hashDigest) {
  return crypto.enc.Base64.stringify(hashDigest);
}

/**
 * Fetches all records from a specific Airtable table and view
 * @param {Object} config - Configuration object for the table
 * @returns {Promise<Array>} Array of processed records
 */
async function getRecordsFromAirtable(config) {
  const records = [];

  try {
    await new Promise((resolve, reject) => {
      base(config.tableName)
        .select({
          maxRecords: 3000,
          view: config.view,
        })
        .eachPage(
          function page(pageRecords, fetchNextPage) {
            console.log(
              `Processing ${config.tableName} page with ${pageRecords.length} records...`
            );

            const validRecords = pageRecords
              .map(config.processRecord)
              .filter(Boolean);

            records.push(...validRecords);
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              console.error(
                `Error during ${config.tableName} pagination:`,
                err
              );
              reject(err);
              return;
            }
            resolve();
          }
        );
    });

    console.log(
      `Total ${config.tableName} records processed: ${records.length}`
    );
    return records;
  } catch (error) {
    console.error(`Error fetching ${config.tableName} from Airtable:`, error);
    throw error;
  }
}

/**
 * Ensures the data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Ensured data directory exists at: ${DATA_DIR}`);
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.error("Failed to create data directory:", error);
      throw error;
    }
  }
}

/**
 * Saves data to a local JSON file
 * @param {string} filename - Name of the file to save
 * @param {Array} data - Data to save
 */
async function saveDataLocally(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    await ensureDataDir();
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, "utf8");
    console.log(`Data successfully saved to: ${filePath}`);
    console.log(`Total records saved: ${data.length}`);
  } catch (error) {
    console.error(`Error saving data to ${filename}:`, error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("Starting Airtable data sync...");

  try {
    for (const config of SYNC_CONFIG) {
      console.log(`\nProcessing ${config.tableName}...`);
      const data = await getRecordsFromAirtable(config);
      await saveDataLocally(config.outputFile, data);
    }
    console.log("\nData sync completed successfully!");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

// Export functions for use as a module
export { getRecordsFromAirtable, saveDataLocally, SYNC_CONFIG };
