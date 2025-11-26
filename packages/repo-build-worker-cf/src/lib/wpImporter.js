import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

class WpImporter {
  constructor(options = {}) {
    // Set default options
    this.options = {
      outputDir: options.outputDir || "source",
      exportFile: options.exportFile || "export.xml",
      postFolders:
        options.postFolders !== undefined ? options.postFolders : true,
      prefixDate: options.prefixDate !== undefined ? options.prefixDate : false,
      dateFolders: options.dateFolders || "none",
      saveImages: options.saveImages || "all",
      wizard: options.wizard !== undefined ? options.wizard : false,
      frontmatterFields:
        options.frontmatterFields ||
        "title,date,categories,tags,coverImage,draft",
      requestDelay: options.requestDelay || 500,
      writeDelay: options.writeDelay || 10,
      timezone: options.timezone || "utc",
      includeTime:
        options.includeTime !== undefined ? options.includeTime : false,
      dateFormat: options.dateFormat || "",
      quoteDate: options.quoteDate !== undefined ? options.quoteDate : false,
      strictSsl: options.strictSsl !== undefined ? options.strictSsl : false,
    };
  }

  async validateExportFile() {
    try {
      await fs.access(this.options.exportFile);
      return true;
    } catch (error) {
      throw new Error(`Export file not found: ${this.options.exportFile}`);
    }
  }

  buildCommandArgs() {
    // Map our option keys to the CLI tool's expected argument names
    const argMap = {
      outputDir: "output-dir",
      exportFile: "input",
      postFolders: "post-folders",
      prefixDate: "prefix-date",
      dateFolders: "date-folders",
      saveImages: "save-images",
      wizard: "wizard",
      frontmatterFields: "frontmatter",
      requestDelay: "request-delay",
      writeDelay: "throttle",
      timezone: "time-zone",
      includeTime: "include-time",
      dateFormat: "date-format",
      quoteDate: "quote-date",
      strictSsl: "strict-ssl",
    };

    // Build argument array
    const args = [];

    // First process the boolean flags properly
    for (const [key, value] of Object.entries(this.options)) {
      const argName = argMap[key] || key;

      if (typeof value === "boolean") {
        // Boolean values need to be handled specifically with =true or =false
        args.push(`--${argName}=${value}`);
      } else if (value === "") {
        // Skip empty string values
        continue;
      } else {
        // Regular values need quotes
        args.push(`--${argName}="${value}"`);
      }
    }

    return args.join(" ");
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  logOptions() {
    console.log("🔧 WpImporter Configuration:");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    // Log each option in formatted table
    Object.entries(this.options).forEach(([key, value]) => {
      const formattedKey = key.padEnd(20, " ");
      console.log(`  ${formattedKey}: ${value}`);
    });
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
  }

  async importWithNpx() {
    // Create a command with npx
    const command = `npx wordpress-export-to-markdown --input "${this.options.exportFile}" --output "${this.options.outputDir}" --post-folders=${this.options.postFolders} --prefix-date=${this.options.prefixDate} --date-folders=${this.options.dateFolders} --save-images=${this.options.saveImages} --wizard=${this.options.wizard} --frontmatter-fields="${this.options.frontmatterFields}" --request-delay=${this.options.requestDelay} --write-delay=${this.options.writeDelay} --timezone=${this.options.timezone} --include-time=${this.options.includeTime} --quote-date=${this.options.quoteDate}`;

    console.log(`🚀 Starting WordPress export conversion with npx...`);
    console.log(`Command: ${command}`);

    return this.executeCommand(command);
  }

  async importWithDirectAppJs() {
    try {
      // Go directly to app.js which we know works
      const rootDir = process.cwd();
      const appJsFile = path.join(rootDir, 'node_modules', 'wordpress-export-to-markdown', 'app.js');
      
      try {
        await fs.access(appJsFile);
        console.log(`✅ Found app.js file at: ${appJsFile}`);
        
        // Use node to run the script directly
        const command = `node "${appJsFile}" --input "${this.options.exportFile}" --output "${this.options.outputDir}" --post-folders=${this.options.postFolders} --prefix-date=${this.options.prefixDate} --date-folders=${this.options.dateFolders} --save-images=${this.options.saveImages} --wizard=${this.options.wizard} --frontmatter-fields="${this.options.frontmatterFields}" --request-delay=${this.options.requestDelay} --write-delay=${this.options.writeDelay} --timezone=${this.options.timezone} --include-time=${this.options.includeTime} --quote-date=${this.options.quoteDate}`;
        
        console.log(`🚀 Starting WordPress export conversion with direct node call to app.js...`);
        console.log(`Command: ${command}`);
        
        return this.executeCommand(command);
      } catch (error) {
        console.log(`⚠️ App.js file not found at ${appJsFile}, falling back to npx`);
        return this.importWithNpx();
      }
    } catch (error) {
      console.error(`Error trying to access app.js: ${error.message}`);
      return this.importWithNpx();
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const process = exec(command, {
        maxBuffer: 1024 * 1024 * 10,
        shell: true,
      }); // 10MB buffer

      process.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      process.stderr.on("data", (data) => {
        console.error(data.toString());
      });

      process.on("close", (code) => {
        if (code === 0) {
          console.log("Conversion completed successfully!");
          resolve(true);
        } else {
          console.error(`Process exited with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  async import() {
    try {
      // Log detailed configuration
      this.logOptions();

      // Validate export file exists
      await this.validateExportFile();
      console.log(`✅ Export file validated: ${this.options.exportFile}`);

      // Create output directory if it doesn't exist
      await this.ensureOutputDir();
      console.log(`✅ Output directory ensured: ${this.options.outputDir}`);
      
      // Use the direct app.js approach that we know works
      return this.importWithDirectAppJs();
    } catch (error) {
      console.error("Failed to convert WordPress export:", error);
      return false;
    }
  }
}

export default WpImporter;
