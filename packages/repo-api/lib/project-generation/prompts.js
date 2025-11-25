export const PROJECT_GENERATION_SYSTEM_PROMPT = `You are an expert software developer and project generator for Repo.md platform. Your job is to analyze user project briefs and create complete, functional project structures.

IMPORTANT GUIDELINES:
1. Generate COMPLETE, WORKING code - not just templates or placeholders
2. Include all necessary configuration files (package.json, .gitignore, etc.)
3. Create a proper project structure with appropriate folders
4. Add comprehensive README.md with:
   - Project title and description
   - Project ID and Repo.md metadata
   - Links to admin dashboard
   - Setup instructions
   - Development guidelines
5. Include basic error handling and best practices
6. Make the code production-ready, not just demo code
7. Add comments explaining key functionality
8. Include appropriate dependencies and scripts
9. Follow security best practices - never hardcode secrets

REPO.MD SPECIFIC REQUIREMENTS:
1. Always include a .repo-md.json file with project metadata
2. Add links to the Repo.md admin dashboard in README
3. Include documentation structure compatible with Repo.md parsing
4. Use markdown format for all documentation files

OUTPUT FORMAT:
You must output ONLY valid markdown content. No explanations, no JSON, no code blocks with language identifiers.
The content should be ready to be directly written to files.

COMMON PROJECT TYPES TO RECOGNIZE:
- Web apps (React, Vue, Next.js, vanilla HTML/CSS/JS)
- APIs (Node.js Express, Python FastAPI, Go, etc.)
- CLI tools and scripts
- Documentation sites
- Mobile apps (React Native, Flutter)
- Desktop applications (Electron)
- Games
- Data analysis projects
- Machine learning projects
- Static websites
- Jamstack applications`;

export const PROJECT_BRIEF_ANALYSIS_PROMPT = `Analyze the following project brief and extract key requirements. Identify:
1. Project type and technology stack
2. Core features and functionality
3. Target audience
4. Technical requirements
5. Any specific integrations needed

Brief: {brief}

Based on this analysis, generate a complete project structure.`;

export const SANITIZATION_PROMPT = `Review the generated content and ensure:
1. No sensitive information or secrets are included
2. All placeholders are replaced with proper values
3. Code follows security best practices
4. Documentation is clear and complete
5. File paths are valid and properly structured

Make any necessary corrections while maintaining functionality.`;

export function buildProjectGenerationPrompt(brief, projectId, orgSlug) {
  return `${PROJECT_GENERATION_SYSTEM_PROMPT}

PROJECT BRIEF:
${brief}

PROJECT METADATA:
- Project ID: ${projectId}
- Organization: ${orgSlug}
- Admin URL: https://repo.md/org/${orgSlug}/project/${projectId}
- Deploy URL: https://${projectId}.repo.md

Generate the complete project structure based on the brief above. Include all necessary files and documentation.`;
}

export function buildFileGenerationTool() {
  return {
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
          techStack: {
            type: "array",
            items: { type: "string" },
            description: "Technologies and frameworks used in the project",
          },
          files: {
            type: "object",
            description:
              "Object with file paths as keys and file contents as strings",
            additionalProperties: {
              type: "string",
            },
          },
          features: {
            type: "array",
            items: { type: "string" },
            description: "Key features implemented in the project",
          },
        },
        required: [
          "projectType",
          "description",
          "files",
          "techStack",
          "features",
        ],
      },
    },
  };
}

export function generateBoilerplateFiles(projectId, projectName, orgSlug) {
  return {
    ".repo-md.json": JSON.stringify(
      {
        projectId,
        projectName,
        orgSlug,
        version: "1.0.0",
        created: new Date().toISOString(),
        platform: "repo.md",
      },
      null,
      2
    ),

    "docs/README.md": `# ${projectName} Documentation

This documentation is powered by [Repo.md](https://repo.md).

## Quick Links

- [Admin Dashboard](https://repo.md/${orgSlug}/${projectId}) 
- [API Documentation](./api/README.md)
- [Development Guide](./development/README.md)

## Project Overview

Project ID: \`${projectId}\`
Organization: \`${orgSlug}\`

## Getting Started

See the [Development Guide](./development/README.md) for setup instructions.`,

    "docs/development/README.md": `# Development Guide

## Prerequisites

- Node.js 18+ (if applicable)
- Git
- Access to the Repo.md admin dashboard

## Setup

1. Clone the repository
2. Install dependencies (if applicable)
3. Configure environment variables
4. Start the development server

## Deployment

This project is automatically deployed via Repo.md when changes are pushed to the main branch.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.`,

    "docs/api/README.md": `# API Documentation

## Overview

API documentation for ${projectName}.

## Endpoints

Document your API endpoints here.

## Authentication

Describe authentication methods if applicable.

## Examples

Provide usage examples.`,
  };
}
