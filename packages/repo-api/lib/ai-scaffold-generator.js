/**
 * AI Scaffold Generator - Generates project files based on a brief
 * This is a mock implementation that will be replaced with actual LLM calls
 */

/**
 * Generate project files based on a brief
 * @param {string} brief - User's project description
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated files and metadata
 */
export async function generateProjectFromBrief(brief, options = {}) {
	const {
		projectType = "web",
		language = "javascript",
		framework = null,
	} = options;

	// Mock implementation - simulate processing time
	await new Promise(resolve => setTimeout(resolve, 500));

	// Parse the brief to extract key information
	const projectName = extractProjectName(brief);
	const isTypescript = brief.toLowerCase().includes("typescript") || language === "typescript";
	const isReact = brief.toLowerCase().includes("react") || framework === "react";
	const isNextjs = brief.toLowerCase().includes("next") || framework === "nextjs";
	const isApi = brief.toLowerCase().includes("api") || projectType === "api";

	// Generate appropriate files based on the brief
	let files = {};

	if (isNextjs) {
		files = generateNextjsProject(projectName, brief, isTypescript);
	} else if (isReact) {
		files = generateReactProject(projectName, brief, isTypescript);
	} else if (isApi) {
		files = generateApiProject(projectName, brief, isTypescript);
	} else {
		files = generateBasicWebProject(projectName, brief, isTypescript);
	}

	// Add common files
	files[".gitignore"] = generateGitignore(projectType);
	files[".env.example"] = generateEnvExample(brief);
	files["README.md"] = generateReadme(projectName, brief, Object.keys(files));

	return {
		files,
		metadata: {
			projectName,
			projectType: isNextjs ? "nextjs" : isReact ? "react" : isApi ? "api" : "web",
			language: isTypescript ? "typescript" : "javascript",
			framework: isNextjs ? "nextjs" : isReact ? "react" : null,
			fileCount: Object.keys(files).length,
			generatedAt: new Date().toISOString(),
			brief: brief,
		},
		prompt: `Generated a ${isTypescript ? "TypeScript" : "JavaScript"} project based on the brief: "${brief}"`,
	};
}

// Helper functions

function extractProjectName(brief) {
	// Try to extract project name from brief
	const nameMatch = brief.match(/(?:called|named|project|app|application)\s+["']?([a-zA-Z0-9-_]+)["']?/i);
	if (nameMatch) {
		return nameMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "-");
	}
	
	// Generate a name from the first few words
	const words = brief.split(" ").slice(0, 3).join("-");
	return words.toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 20);
}

function generateNextjsProject(name, brief, isTypescript) {
	const ext = isTypescript ? "tsx" : "jsx";
	const files = {};

	files["package.json"] = JSON.stringify({
		name: name,
		version: "1.0.0",
		private: true,
		scripts: {
			dev: "next dev",
			build: "next build",
			start: "next start",
			lint: "next lint",
		},
		dependencies: {
			next: "14.0.0",
			react: "^18.2.0",
			"react-dom": "^18.2.0",
		},
		devDependencies: isTypescript ? {
			"@types/node": "^20",
			"@types/react": "^18",
			"@types/react-dom": "^18",
			typescript: "^5",
		} : {},
	}, null, 2);

	files[`app/page.${ext}`] = `export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">${name}</h1>
      <p className="text-lg text-gray-600">
        ${brief}
      </p>
    </main>
  );
}`;

	files["app/layout.tsx"] = `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`;

	files["app/globals.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

	if (isTypescript) {
		files["tsconfig.json"] = JSON.stringify({
			compilerOptions: {
				target: "es5",
				lib: ["dom", "dom.iterable", "esnext"],
				allowJs: true,
				skipLibCheck: true,
				strict: true,
				forceConsistentCasingInFileNames: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "node",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "preserve",
				incremental: true,
				plugins: [{ name: "next" }],
				paths: { "@/*": ["./*"] },
			},
			include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
			exclude: ["node_modules"],
		}, null, 2);
	}

	return files;
}

function generateReactProject(name, brief, isTypescript) {
	const ext = isTypescript ? "tsx" : "jsx";
	const files = {};

	files["package.json"] = JSON.stringify({
		name: name,
		version: "1.0.0",
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
		devDependencies: isTypescript ? {
			"@types/react": "^18",
			"@types/react-dom": "^18",
			typescript: "^5",
		} : {},
	}, null, 2);

	files[`src/App.${ext}`] = `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>${name}</h1>
      <p>${brief}</p>
    </div>
  );
}

export default App;`;

	files[`src/index.${isTypescript ? "tsx" : "js"}`] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

	files["src/index.css"] = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`;

	files["public/index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${brief}" />
    <title>${name}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;

	return files;
}

function generateApiProject(name, brief, isTypescript) {
	const ext = isTypescript ? "ts" : "js";
	const files = {};

	files["package.json"] = JSON.stringify({
		name: name,
		version: "1.0.0",
		private: true,
		main: `src/index.${ext}`,
		scripts: {
			start: isTypescript ? "ts-node src/index.ts" : "node src/index.js",
			dev: isTypescript ? "nodemon --exec ts-node src/index.ts" : "nodemon src/index.js",
			build: isTypescript ? "tsc" : "echo 'No build step required'",
		},
		dependencies: {
			express: "^4.18.2",
			cors: "^2.8.5",
			dotenv: "^16.0.3",
		},
		devDependencies: {
			nodemon: "^3.0.1",
			...(isTypescript ? {
				"@types/express": "^4.17.17",
				"@types/node": "^20",
				"ts-node": "^10.9.1",
				typescript: "^5",
			} : {}),
		},
	}, null, 2);

	files[`src/index.${ext}`] = `${isTypescript ? "import express from 'express';\nimport cors from 'cors';" : "const express = require('express');\nconst cors = require('cors');"}
${isTypescript ? "" : "require('dotenv').config();"}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req${isTypescript ? ": express.Request" : ""}, res${isTypescript ? ": express.Response" : ""}) => {
  res.json({ 
    message: 'Welcome to ${name} API',
    description: '${brief}'
  });
});

app.get('/health', (req${isTypescript ? ": express.Request" : ""}, res${isTypescript ? ": express.Response" : ""}) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});`;

	if (isTypescript) {
		files["tsconfig.json"] = JSON.stringify({
			compilerOptions: {
				target: "es6",
				module: "commonjs",
				outDir: "./dist",
				rootDir: "./src",
				strict: true,
				esModuleInterop: true,
				skipLibCheck: true,
				forceConsistentCasingInFileNames: true,
			},
			include: ["src/**/*"],
			exclude: ["node_modules"],
		}, null, 2);
	}

	return files;
}

function generateBasicWebProject(name, brief, isTypescript) {
	const files = {};

	files["index.html"] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${brief}">
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>${name}</h1>
  </header>
  <main>
    <p>${brief}</p>
  </main>
  <script src="script.js"></script>
</body>
</html>`;

	files["styles.css"] = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f4f4f4;
}

header {
  background-color: #333;
  color: white;
  padding: 1rem;
  text-align: center;
}

main {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 2rem;
}`;

	files["script.js"] = `// ${name} - Main JavaScript file
console.log('${name} loaded successfully');

// Initialize your application
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - ${brief}');
});`;

	files["package.json"] = JSON.stringify({
		name: name,
		version: "1.0.0",
		private: true,
		description: brief,
		scripts: {
			start: "python -m http.server 8000 || python3 -m http.server 8000",
		},
	}, null, 2);

	return files;
}

function generateGitignore(projectType) {
	const common = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Build outputs
dist/
build/
*.log`;

	const typeSpecific = {
		nextjs: `
# Next.js
.next/
out/
.vercel`,
		react: `
# React
/coverage
/build`,
		api: `
# API
logs/
*.log
pid
*.pid
*.seed`,
		web: `
# Web
.cache/
.parcel-cache/`,
	};

	return common + (typeSpecific[projectType] || "");
}

function generateEnvExample(brief) {
	const envVars = [];

	// Detect common services mentioned in the brief
	if (brief.toLowerCase().includes("database") || brief.toLowerCase().includes("db")) {
		envVars.push("DATABASE_URL=postgresql://user:password@localhost:5432/dbname");
	}
	if (brief.toLowerCase().includes("api")) {
		envVars.push("API_KEY=your_api_key_here");
		envVars.push("API_URL=https://api.example.com");
	}
	if (brief.toLowerCase().includes("auth")) {
		envVars.push("JWT_SECRET=your_jwt_secret_here");
		envVars.push("AUTH_DOMAIN=auth.example.com");
	}
	if (brief.toLowerCase().includes("email")) {
		envVars.push("SMTP_HOST=smtp.example.com");
		envVars.push("SMTP_USER=user@example.com");
		envVars.push("SMTP_PASS=your_password");
	}

	// Always include basic vars
	envVars.push("PORT=3000");
	envVars.push("NODE_ENV=development");

	return envVars.join("\n");
}

function generateReadme(name, brief, fileList) {
	return `# ${name}

${brief}

## Overview

This project was generated using AI based on your brief. It includes the following structure:

${fileList.filter(f => !f.startsWith(".")).map(f => `- \`${f}\``).join("\n")}

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone this repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Copy the environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Start the development server:
   \`\`\`bash
   npm start
   \`\`\`

## Project Structure

This project was scaffolded based on your requirements. Feel free to modify the structure and add more features as needed.

## Next Steps

1. Review the generated files and customize them to your needs
2. Update this README with more specific information about your project
3. Configure your environment variables in \`.env\`
4. Start building your application!

---

Generated with ❤️ by Repo.md AI Scaffold
`;
}