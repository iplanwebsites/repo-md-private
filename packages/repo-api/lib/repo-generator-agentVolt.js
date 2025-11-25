import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { GitHubBulkOps } from "./github-bulk-ops.js";
import { createHeliconeProvider } from "./volt/voltAgentConfig.js";

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
      this.isEnabled = true;
    } else {
      this.isEnabled = false;
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
   * Create a project generation tool
   */
  createProjectGenerationTool() {
    return createTool({
      name: "generate_project_files",
      description:
        "Generate project files and structure based on user requirements",
      parameters: z.object({
        projectType: z
          .string()
          .describe(
            "Type of project (e.g., 'React App', 'Node.js API', 'Python Script', 'Documentation Site')"
          ),
        description: z
          .string()
          .describe("Brief description of what the project does"),
        files: z
          .record(z.string())
          .describe(
            "Object with file paths as keys and file contents as strings"
          ),
      }),
      execute: async (args) => {
        // The tool just returns the structured data
        return args;
      },
    });
  }

  /**
   * Create a Volt Agent for repo generation
   */
  createRepoGenerationAgent() {
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

    return new Agent({
      name: "RepoGenerator",
      instructions: systemPrompt,
      llm: createHeliconeProvider(),
      model: openai("gpt-4.1-mini"),
      tools: [this.createProjectGenerationTool()],
      markdown: false,
      memory: false, // Disable SQLite memory
    });
  }

  /**
   * Generate a repository from a user prompt using Volt Agent with tool calling
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
        console.log("🤖 Step 1: Analyzing prompt with Volt Agent...");
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
          },
        };
      }

      // Step 3: Execute GitHub repository creation (if not simulating)
      if (!this.github) {
        return {
          success: false,
          error: "GitHub token not provided",
          details: "Cannot create repository without GitHub access",
        };
      }

      if (verbose) {
        console.log(
          `🔨 Step 2: Creating GitHub repository ${owner}/${repo}...`
        );
      }

      const commitMessage = `🚀 AI-Generated ${projectType}: ${description}`;
      const githubResult = await this.github.createAndBootstrapRepo(
        owner,
        repo,
        files,
        commitMessage,
        {
          branch,
          private: repoOptions.private || false,
          description: description || `AI-Generated ${projectType}`,
        }
      );

      if (!githubResult.success) {
        return {
          success: false,
          error: "Failed to create GitHub repository",
          details: githubResult.error,
        };
      }

      if (verbose) {
        console.log(`✅ Repository created successfully!`);
        console.log(`🔗 URL: ${githubResult.repository.url}`);
        console.log(`📝 Commit: ${githubResult.commitSha}`);
        console.log("");
      }

      return {
        success: true,
        data: {
          ...githubResult,
          projectType,
          description,
          fileCount: Object.keys(files).length,
        },
      };
    } catch (error) {
      console.error("❌ Repo generation failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Analyze prompt with AI and generate project structure
   * @private
   */
  async _analyzePromptWithAI(prompt, verbose = false) {
    // Check if OpenAI is available
    if (!this.isEnabled) {
      if (verbose) {
        console.log("   🎭 Using mock generation (OpenAI not configured)");
      }
      return this._mockAIGeneration(prompt, verbose);
    }

    try {
      if (verbose) {
        console.log("   🧠 Sending prompt to Volt Agent with tool calling...");
      }

      const agent = this.createRepoGenerationAgent();

      // Get response from agent
      const response = await agent.generateText(prompt, {
        provider: {
          temperature: 0.8,
          maxTokens: 8000,
        },
      });

      if (verbose) {
        console.log("   ✅ Volt Agent response received");
        if (response.usage) {
          console.log(
            `   🔢 Tokens used: ${response.usage.totalTokens || "unknown"}`
          );
        }
      }

      // Parse the response to extract tool call results
      let functionArgs;
      try {
        // Try to parse JSON from response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          functionArgs = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, the tool might have been executed internally
          // Check if the response contains the expected structure
          if (verbose) {
            console.log(
              "   🔍 No JSON in response, checking for tool execution..."
            );
          }
          throw new Error("No valid JSON structure in response");
        }
      } catch (parseError) {
        console.error("   ❌ Failed to parse Volt Agent response:", parseError);
        if (verbose) {
          console.log(
            "   🎭 Falling back to mock generation due to parse error"
          );
        }
        return this._mockAIGeneration(prompt, verbose);
      }

      // Validate the response
      if (
        !functionArgs ||
        !functionArgs.files ||
        typeof functionArgs.files !== "object"
      ) {
        console.error("   ❌ Invalid Volt Agent response structure:", {
          hasArgs: !!functionArgs,
          hasFiles: !!(functionArgs && functionArgs.files),
          filesType: functionArgs && typeof functionArgs.files,
        });

        if (verbose) {
          console.log(
            "   🎭 Falling back to mock generation due to invalid response"
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
      console.error("   ❌ Volt Agent analysis failed:", error);
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
      projectType = "Vue App";
      framework = "vue";
    } else if (lowerPrompt.includes("api") || lowerPrompt.includes("backend")) {
      projectType = "Node.js API";
      framework = "express";
    } else if (lowerPrompt.includes("python")) {
      projectType = "Python Script";
      language = "python";
      if (lowerPrompt.includes("fastapi")) {
        projectType = "Python FastAPI";
        framework = "fastapi";
      }
    } else if (lowerPrompt.includes("cli") || lowerPrompt.includes("command")) {
      projectType = "CLI Tool";
    }

    // Generate files based on project type
    let files = {};

    switch (framework) {
      case "react":
        files = this._generateReactFiles(prompt, language === "typescript");
        break;
      case "vue":
        files = this._generateVueFiles(prompt);
        break;
      case "express":
        files = this._generateExpressFiles(prompt);
        break;
      case "fastapi":
        files = this._generateFastAPIFiles(prompt);
        break;
      default:
        files = this._generateStaticSiteFiles(prompt);
    }

    if (verbose) {
      console.log(`   ✅ Mock generation complete: ${projectType}`);
    }

    return {
      success: true,
      data: {
        projectType,
        description: `Mock-generated ${projectType} based on prompt`,
        files,
      },
    };
  }

  /**
   * Generate React project files
   * @private
   */
  _generateReactFiles(prompt, typescript = false) {
    const ext = typescript ? "tsx" : "jsx";
    const files = {
      "package.json": JSON.stringify(
        {
          name: "my-react-app",
          version: "0.1.0",
          private: true,
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "react-scripts": "5.0.1",
          },
          scripts: {
            start: "react-scripts start",
            build: "react-scripts build",
            test: "react-scripts test",
            eject: "react-scripts eject",
          },
          eslintConfig: {
            extends: ["react-app"],
          },
          browserslist: {
            production: [">0.2%", "not dead", "not op_mini all"],
            development: [
              "last 1 chrome version",
              "last 1 firefox version",
              "last 1 safari version",
            ],
          },
        },
        null,
        2
      ),

      "public/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#000000" />
  <meta name="description" content="React app created from prompt" />
  <title>React App</title>
</head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>
</html>`,

      [`src/App.${ext}`]: `${
        typescript ? "import React from 'react';\n" : ""
      }import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to React</h1>
        <p>Generated from: "${prompt}"</p>
      </header>
    </div>
  );
}

export default App;`,

      [`src/index.${typescript ? "tsx" : "js"}`]: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')${
        typescript ? " as HTMLElement" : ""
      });
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

      "src/App.css": `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}`,

      "src/index.css": `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`,

      ".gitignore": `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*`,

      "README.md": `# React App

This project was generated from the prompt: "${prompt}"

## Available Scripts

In the project directory, you can run:

### \`npm start\`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### \`npm test\`

Launches the test runner in the interactive watch mode.

### \`npm run build\`

Builds the app for production to the \`build\` folder.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).`,
    };

    if (typescript) {
      files["tsconfig.json"] = JSON.stringify(
        {
          compilerOptions: {
            target: "es5",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            noFallthroughCasesInSwitch: true,
            module: "esnext",
            moduleResolution: "node",
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
          },
          include: ["src"],
        },
        null,
        2
      );
    }

    return files;
  }

  /**
   * Generate Vue project files
   * @private
   */
  _generateVueFiles(prompt) {
    return {
      "package.json": JSON.stringify(
        {
          name: "my-vue-app",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            vue: "^3.3.4",
          },
          devDependencies: {
            "@vitejs/plugin-vue": "^4.2.3",
            vite: "^4.4.5",
          },
        },
        null,
        2
      ),

      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,

      "src/main.js": `import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')`,

      "src/App.vue": `<template>
  <div>
    <h1>{{ msg }}</h1>
    <p>Generated from: "{{ prompt }}"</p>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      msg: 'Welcome to Vue 3!',
      prompt: '${prompt}'
    }
  }
}
</script>

<style scoped>
h1 {
  color: #42b883;
}
</style>`,

      "src/style.css": `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`,

      "vite.config.js": `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,

      ".gitignore": `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`,

      "README.md": `# Vue 3 + Vite

This project was generated from the prompt: "${prompt}"

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

\`\`\`sh
npm install
\`\`\`

### Compile and Hot-Reload for Development

\`\`\`sh
npm run dev
\`\`\`

### Compile and Minify for Production

\`\`\`sh
npm run build
\`\`\``,
    };
  }

  /**
   * Generate Express API files
   * @private
   */
  _generateExpressFiles(prompt) {
    return {
      "package.json": JSON.stringify(
        {
          name: "my-api",
          version: "1.0.0",
          description: "Express API generated from prompt",
          main: "index.js",
          scripts: {
            start: "node index.js",
            dev: "nodemon index.js",
          },
          dependencies: {
            express: "^4.18.2",
            cors: "^2.8.5",
            dotenv: "^16.0.3",
          },
          devDependencies: {
            nodemon: "^2.0.20",
          },
        },
        null,
        2
      ),

      "index.js": `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Express API',
    generated_from: '${prompt}'
  });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from API!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});`,

      ".env.example": `PORT=3000
NODE_ENV=development`,

      ".gitignore": `node_modules/
.env
.DS_Store
*.log
dist/`,

      "README.md": `# Express API

This API was generated from the prompt: "${prompt}"

## Setup

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Create a \`.env\` file based on \`.env.example\`

3. Run the server:
   \`\`\`
   npm start
   \`\`\`

   Or for development with auto-reload:
   \`\`\`
   npm run dev
   \`\`\`

## Endpoints

- \`GET /\` - Welcome message
- \`GET /api/hello\` - Sample API endpoint`,
    };
  }

  /**
   * Generate FastAPI files
   * @private
   */
  _generateFastAPIFiles(prompt) {
    return {
      "requirements.txt": `fastapi==0.104.1
uvicorn[standard]==0.24.0
python-dotenv==1.0.0
pydantic==2.4.2`,

      "main.py": `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {
        "message": "Welcome to FastAPI",
        "generated_from": "${prompt}"
    }

@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI!"}

@app.post("/api/echo")
def echo(message: Message):
    return {"echo": message.text}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,

      ".env.example": `PORT=8000
ENVIRONMENT=development`,

      ".gitignore": `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.env
.venv
pip-log.txt
pip-delete-this-directory.txt
.coverage
.pytest_cache/
.mypy_cache/
.dmypy.json
dmypy.json`,

      "README.md": `# FastAPI Application

This API was generated from the prompt: "${prompt}"

## Setup

1. Create a virtual environment:
   \`\`\`
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`
   pip install -r requirements.txt
   \`\`\`

3. Run the server:
   \`\`\`
   uvicorn main:app --reload
   \`\`\`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

- \`GET /\` - Welcome message
- \`GET /api/hello\` - Sample endpoint
- \`POST /api/echo\` - Echo back a message`,
    };
  }

  /**
   * Generate static site files
   * @private
   */
  _generateStaticSiteFiles(prompt) {
    return {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Website</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to My Website</h1>
        <nav>
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section id="home">
            <h2>Home</h2>
            <p>This website was generated from: "${prompt}"</p>
        </section>
        
        <section id="about">
            <h2>About</h2>
            <p>This is a simple static website created with HTML, CSS, and JavaScript.</p>
        </section>
        
        <section id="contact">
            <h2>Contact</h2>
            <p>Get in touch with us!</p>
        </section>
    </main>
    
    <footer>
        <p>&copy; 2024 My Website. All rights reserved.</p>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>`,

      "styles.css": `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
}

header {
    background: #333;
    color: #fff;
    padding: 1rem 0;
    text-align: center;
}

nav ul {
    list-style: none;
    padding: 1rem 0;
}

nav ul li {
    display: inline;
    margin: 0 1rem;
}

nav ul li a {
    color: #fff;
    text-decoration: none;
}

nav ul li a:hover {
    text-decoration: underline;
}

main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
}

section {
    margin: 2rem 0;
}

footer {
    background: #333;
    color: #fff;
    text-align: center;
    padding: 1rem 0;
    position: fixed;
    bottom: 0;
    width: 100%;
}`,

      "script.js": `// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Log when page loads
console.log('Website loaded successfully!');
console.log('Generated from prompt: "${prompt}"');`,

      "README.md": `# Static Website

This website was generated from the prompt: "${prompt}"

## Structure

- \`index.html\` - Main HTML file
- \`styles.css\` - CSS styles
- \`script.js\` - JavaScript functionality

## How to Run

1. Open \`index.html\` in a web browser
2. Or use a local server:
   \`\`\`
   python -m http.server 8000
   # or
   npx http-server
   \`\`\`

## Features

- Responsive design
- Smooth scrolling navigation
- Clean and modern layout`,
    };
  }
}
