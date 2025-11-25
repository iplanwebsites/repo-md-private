import OpenAI from "openai";
import { GitHubBulkOps } from "./github-bulk-ops.js";

export class RepoGeneratorAgent {
  constructor(openaiApiKey, githubToken) {
    this.openaiApiKey = openaiApiKey;
    this.githubToken = githubToken;

    if (
      openaiApiKey &&
      openaiApiKey !== "fake-key" &&
      openaiApiKey !== "mock" &&
      !openaiApiKey.startsWith("sk-fake")
    ) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    } else {
      this.openai = null;
      console.log("⚠️ OpenAI API key not provided - using mock mode");
    }

    if (githubToken && githubToken !== "fake-token") {
      this.github = new GitHubBulkOps(githubToken);
    } else {
      this.github = null;
      console.log("⚠️ GitHub token not provided - simulation only");
    }
  }

  /**
   * Generate a repository from a user prompt using OpenAI with tool calling
   * @param {string} prompt - User's description of what they want to create
   * @param {string} owner - GitHub repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Additional options
   */
  async generateRepoFromPrompt(prompt, owner, repo, options = {}) {
    const {
      branch = "main",
      simulate = false,
      verbose = true,
      repoOptions = {},
    } = options;

    if (verbose) {
      console.log("🚀 Starting repo generation from prompt...");
      console.log(`📝 Prompt: "${prompt}"`);
      console.log(`📁 Target: ${owner}/${repo} (branch: ${branch})`);
      console.log(`🔧 Simulation mode: ${simulate}`);
      console.log("");
    }

    try {
      // Step 1: Analyze prompt and generate file structure
      if (verbose) {
        console.log("🤖 Step 1: Analyzing prompt with OpenAI...");
      }

      const analysisResult = await this._analyzePromptWithAI(prompt, verbose);

      if (!analysisResult.success) {
        return {
          success: false,
          error: "Failed to analyze prompt",
          details: analysisResult.error,
        };
      }

      const { projectType, files, description } = analysisResult.data;

      // Additional validation
      if (
        !files ||
        typeof files !== "object" ||
        Object.keys(files).length === 0
      ) {
        return {
          success: false,
          error: "No valid project files generated",
          details: "The AI analysis did not produce any files",
        };
      }

      if (verbose) {
        console.log(
          `✅ Analysis complete! Detected project type: ${projectType}`
        );
        console.log(`📄 Generated ${Object.keys(files).length} files`);
        console.log(`📝 Description: ${description}`);
        console.log("");
      }

      // Step 2: Simulate or execute repository creation
      if (simulate) {
        if (verbose) {
          console.log(
            "🎭 Step 2: SIMULATION MODE - Would create the following files:"
          );
          Object.entries(files).forEach(([path, content]) => {
            console.log(`  📄 ${path} (${content.length} chars)`);
            if (verbose && content.length < 500) {
              console.log(`     Preview: ${content.substring(0, 100)}...`);
            }
          });
          console.log("");
        }

        return {
          success: true,
          simulation: true,
          data: {
            projectType,
            description,
            files: Object.keys(files),
            fileCount: Object.keys(files).length,
            totalSize: Object.values(files).reduce(
              (sum, content) => sum + content.length,
              0
            ),
          },
        };
      }

      // Step 3: Create repository with generated files
      if (verbose) {
        console.log("🔨 Step 2: Creating repository with generated files...");
      }

      // Check if we have GitHub token for actual repo creation
      if (!this.github) {
        if (verbose) {
          console.log("⚠️ No GitHub token - forcing simulation mode");
        }
        return {
          success: true,
          simulation: true,
          data: {
            projectType,
            description,
            files: Object.keys(files),
            fileCount: Object.keys(files).length,
            totalSize: Object.values(files).reduce(
              (sum, content) => sum + content.length,
              0
            ),
          },
        };
      }

      const commitMessage = `Generated ${projectType} project: ${description}

🤖 Created with AI from prompt: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? "..." : ""
      }"`;

      const result = await this.github.createAndBootstrapRepo(
        owner,
        repo,
        files,
        commitMessage,
        {
          private: repoOptions.private || false,
          description: repoOptions.description || description,
        }
      );

      if (verbose) {
        if (result.success) {
          console.log("✅ Repository created successfully!");
          console.log(`🔗 Repository URL: ${result.repository.url}`);
          console.log(`🔗 Commit SHA: ${result.commitSha}`);
          console.log(`🌐 Commit URL: ${result.commitUrl}`);
        } else {
          console.log("❌ Repository creation failed:", result.error);
        }
        console.log("");
      }

      return {
        success: result.success,
        data: {
          projectType,
          description,
          repository: result.repository,
          commitSha: result.commitSha,
          commitUrl: result.commitUrl,
          fileCount: Object.keys(files).length,
          files: Object.keys(files),
        },
        error: result.error,
      };
    } catch (error) {
      console.error("💥 Error in repo generation:", error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Use OpenAI with tool calling to analyze prompt and generate files
   * @private
   */
  async _analyzePromptWithAI(prompt, verbose = false) {
    try {
      if (verbose) {
        console.log("   🧠 Analyzing prompt...");
      }

      // If no OpenAI API key, use mock generation
      if (!this.openai) {
        if (verbose) {
          console.log("   🎭 Using mock AI generation (no OpenAI API key)");
        }
        return this._mockAIGeneration(prompt, verbose);
      }

      if (verbose) {
        console.log("   🧠 Sending prompt to OpenAI with tool calling...");
      }

      const tools = [
        {
          type: "function",
          function: {
            name: "generate_project_files",
            description:
              "Generate project files and structure based on user requirements",
            parameters: {
              type: "object",
              properties: {
                projectType: {
                  type: "string",
                  description:
                    "Type of project (e.g., 'React App', 'Node.js API', 'Python Script', 'Documentation Site')",
                },
                description: {
                  type: "string",
                  description: "Brief description of what the project does",
                },
                files: {
                  type: "object",
                  description:
                    "Object with file paths as keys and file contents as strings",
                  additionalProperties: {
                    type: "string",
                  },
                },
              },
              required: ["projectType", "description", "files"],
            },
          },
        },
      ];

      const systemPrompt = `You are an expert software developer and project generator. Your job is to analyze user prompts and create complete, functional project structures.

IMPORTANT GUIDELINES:
1. Generate COMPLETE, WORKING code - not just templates or placeholders
2. Include all necessary configuration files (package.json, .gitignore, etc.)
3. Create a proper project structure with appropriate folders
4. Add helpful README.md with setup instructions
5. Include basic error handling and best practices
6. Make the code production-ready, not just demo code
7. Add comments explaining key functionality
8. Include appropriate dependencies and scripts

COMMON PROJECT TYPES TO RECOGNIZE:
- Web apps (React, Vue, vanilla HTML/CSS/JS)
- APIs (Node.js, Python FastAPI, Go, etc.)
- CLI tools and scripts
- Documentation sites
- Mobile apps
- Desktop applications
- Games
- Data analysis projects
- Machine learning projects

Always call the generate_project_files function with your analysis.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: tools,
        tool_choice: {
          type: "function",
          function: { name: "generate_project_files" },
        },
      });

      if (verbose) {
        console.log("   ✅ OpenAI response received");
        console.log(`   💬 Model: ${response.model}`);
        console.log(
          `   🔢 Tokens used: ${response.usage?.total_tokens || "unknown"}`
        );
      }

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.function.name !== "generate_project_files") {
        throw new Error("OpenAI did not call the expected function");
      }

      let functionArgs;
      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error(
          "   ❌ Failed to parse OpenAI function arguments:",
          parseError
        );
        if (verbose) {
          console.log(
            "   🎭 Falling back to mock generation due to JSON parse error"
          );
        }
        return this._mockAIGeneration(prompt, verbose);
      }

      if (verbose) {
        console.log(
          "   🔍 OpenAI function args:",
          JSON.stringify(functionArgs, null, 2)
        );
      }

      // Validate the response
      if (
        !functionArgs ||
        !functionArgs.files ||
        typeof functionArgs.files !== "object"
      ) {
        console.error("   ❌ Invalid OpenAI response structure:", {
          hasArgs: !!functionArgs,
          hasFiles: !!(functionArgs && functionArgs.files),
          filesType: functionArgs && typeof functionArgs.files,
        });

        if (verbose) {
          console.log(
            "   🎭 Falling back to mock generation due to invalid OpenAI response"
          );
        }

        // Fallback to mock generation
        return this._mockAIGeneration(prompt, verbose);
      }

      if (verbose) {
        console.log("   🎯 Tool call successful");
        console.log(`   📋 Project type: ${functionArgs.projectType}`);
        console.log(`   📝 Description: ${functionArgs.description}`);
        console.log(
          `   📁 Files generated: ${Object.keys(functionArgs.files).length}`
        );
      }

      return {
        success: true,
        data: functionArgs,
      };
    } catch (error) {
      console.error("   ❌ OpenAI analysis failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mock AI generation for testing/development when OpenAI API key is not available
   * @private
   */
  async _mockAIGeneration(prompt, verbose = false) {
    if (verbose) {
      console.log("   🎭 Generating mock project based on prompt keywords...");
    }

    // Simple keyword detection to determine project type
    const lowerPrompt = prompt.toLowerCase();
    let projectType = "Static Website";
    let language = "javascript";
    let framework = "vanilla";

    if (lowerPrompt.includes("react")) {
      projectType = "React App";
      framework = "react";
      if (lowerPrompt.includes("typescript")) language = "typescript";
    } else if (lowerPrompt.includes("vue")) {
      projectType = "Vue.js App";
      framework = "vue";
    } else if (
      lowerPrompt.includes("node") ||
      lowerPrompt.includes("api") ||
      lowerPrompt.includes("server")
    ) {
      projectType = "Node.js API";
      framework = "express";
    } else if (lowerPrompt.includes("python")) {
      projectType = "Python Script";
      language = "python";
      framework = "none";
    }

    // Generate basic files based on project type
    const files = this._generateMockFiles(
      projectType,
      language,
      framework,
      prompt
    );

    if (verbose) {
      console.log(
        `   📄 Generated ${
          Object.keys(files).length
        } mock files for ${projectType}`
      );
    }

    return {
      success: true,
      data: {
        projectType,
        description: `Mock ${projectType} project generated from prompt`,
        files,
      },
    };
  }

  /**
   * Generate mock project files based on detected project type
   * @private
   */
  _generateMockFiles(projectType, _language, _framework, prompt) {
    const files = {};

    if (projectType === "React App") {
      files["package.json"] = JSON.stringify(
        {
          name: "react-app",
          version: "1.0.0",
          scripts: {
            start: "react-scripts start",
            build: "react-scripts build",
          },
          dependencies: {
            react: "^18.0.0",
            "react-dom": "^18.0.0",
            "react-scripts": "^5.0.0",
          },
        },
        null,
        2
      );

      files["src/App.js"] = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Generated React App</h1>
        <p>Created from prompt: "${prompt}"</p>
      </header>
    </div>
  );
}

export default App;`;

      files["src/App.css"] = `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
}`;

      files["src/index.js"] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`;

      files["public/index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    } else if (projectType === "Node.js API") {
      files["package.json"] = JSON.stringify(
        {
          name: "node-api",
          version: "1.0.0",
          main: "server.js",
          scripts: {
            start: "node server.js",
            dev: "nodemon server.js",
          },
          dependencies: {
            express: "^4.18.0",
            cors: "^2.8.5",
          },
        },
        null,
        2
      );

      files["server.js"] = `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'API Server Generated from Prompt',
    prompt: "${prompt}"
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;
    } else if (projectType === "Python Script") {
      files["main.py"] = `#!/usr/bin/env python3
"""
Generated Python script from prompt: ${prompt}
"""

def main():
    print("Hello from generated Python script!")
    print(f"Created from prompt: {prompt}")

if __name__ == "__main__":
    main()`;

      files["requirements.txt"] = `# Add your dependencies here
requests>=2.25.0`;
    } else {
      // Default static website
      files["index.html"] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Website</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Generated Website</h1>
    <p>Created from prompt: "${prompt}"</p>
    <script src="script.js"></script>
</body>
</html>`;

      files["style.css"] = `body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
    text-align: center;
}`;

      files["script.js"] = `console.log('Generated website loaded');
console.log('Created from prompt:', '${prompt}');`;
    }

    // Always add common files
    files["README.md"] = `# Generated Project

This project was generated from the prompt: "${prompt}"

## Project Type
${projectType}

## Getting Started
${
  projectType === "Node.js API"
    ? "Run `npm install` then `npm start`"
    : projectType === "React App"
    ? "Run `npm install` then `npm start`"
    : projectType === "Python Script"
    ? "Run `python main.py`"
    : "Open index.html in a browser"
}

## Generated Files
${Object.keys(files)
  .map((file) => `- ${file}`)
  .join("\n")}
`;

    files[".gitignore"] = `node_modules/
.env
.DS_Store
__pycache__/
*.pyc`;

    return files;
  }

  /**
   * Test the agent with a sample prompt (for development/testing)
   */
  async testGeneration(
    prompt = "Create a simple React todo app with local storage"
  ) {
    console.log("🧪 Testing repo generation agent...");
    console.log("");

    const result = await this.generateRepoFromPrompt(
      prompt,
      "test-owner",
      "test-repo",
      {
        simulate: true,
        verbose: true,
      }
    );

    console.log("🧪 Test Results:");
    console.log(JSON.stringify(result, null, 2));

    return result;
  }
}

// Development testing function
export async function testRepoGenerator() {
  const agent = new RepoGeneratorAgent(
    process.env.OPENAI_API_KEY,
    process.env.GITHUB_ACCESS_TOKEN
  );

  const testPrompts = [
    "Create a React todo app with TypeScript and Tailwind CSS",
    "Build a Node.js REST API for a blog with MongoDB",
    "Make a Python CLI tool that processes CSV files",
    "Create a documentation website using HTML/CSS/JS",
  ];

  console.log("🚀 Running multiple test prompts...");
  console.log("");

  for (const prompt of testPrompts) {
    console.log(`📝 Testing: "${prompt}"`);
    console.log("-".repeat(80));

    const result = await agent.generateRepoFromPrompt(
      prompt,
      "test-owner",
      "test-repo",
      { simulate: true, verbose: true }
    );

    console.log("📊 Result summary:");
    if (result.success) {
      console.log(`   ✅ Success: ${result.data.projectType}`);
      console.log(`   📄 Files: ${result.data.fileCount}`);
      console.log(`   💾 Size: ${result.data.totalSize} chars`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("");
  }
}
