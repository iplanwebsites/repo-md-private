import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

import dotenv from "dotenv";
dotenv.config();

let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = "o4-mini"; // gpt-4.1-2025-04-14   //"gpt-4",

console.log(
  OPENAI_API_KEY
    ? "🔑 OpenAI API key detected"
    : "🔒 No OpenAI API key provided, using mock mode"
);

// Mock data for testing without API key
const getMockFiles = (brief) => {
  if (brief.toLowerCase().includes("blog")) {
    return [
      {
        filename: "index.md",
        frontmatter: { title: "Home", date: "2024-01-01", layout: "home" },
        content:
          "# Welcome to My Blog\n\nThis is a personal blog about web development. Check out my [[about]] page and latest [[posts]].",
      },
      {
        filename: "about.md",
        frontmatter: { title: "About", date: "2024-01-01", layout: "page" },
        content:
          "# About Me\n\nI'm a web developer passionate about React and Node.js. See my latest [[posts]] or [[contact]] me.",
      },
      {
        filename: "posts.md",
        frontmatter: { title: "Posts", date: "2024-01-01", layout: "posts" },
        content:
          "# Blog Posts\n\nLatest articles about web development.\n\n- [[react-hooks]]\n- [[nodejs-deployment]]",
      },
      {
        filename: "react-hooks.md",
        frontmatter: {
          title: "React Hooks Guide",
          date: "2024-01-15",
          tags: ["react", "hooks"],
          author: "Developer",
        },
        content:
          "# React Hooks Guide\n\nA comprehensive guide to React hooks. Back to [[posts]].",
      },
      {
        filename: "contact.md",
        frontmatter: { title: "Contact", date: "2024-01-01", layout: "page" },
        content: "# Contact Me\n\nGet in touch! Also check my [[about]] page.",
      },
    ];
  }

  return [
    {
      filename: "index.md",
      frontmatter: { title: "Home", date: "2024-01-01" },
      content:
        "# Welcome\n\nThis is a generated project. Check out [[about]] for more info.",
    },
    {
      filename: "about.md",
      frontmatter: { title: "About", date: "2024-01-01" },
      content:
        "# About\n\nThis project was generated from the brief. Back to [[index]].",
    },
  ];
};

async function createStarterProjectFromBrief(brief, options = {}) {
  const {
    outputDir = "./output",
    model = MODEL,
    temperature = 0.7,
    mockMode = !process.env.OPENAI_API_KEY,
  } = options;

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Create the prompt for OpenAI
    const prompt = `
You are a content generator for the repo.md platform. Given a project brief, generate a JSON array of markdown files to create a starter project.

Project Brief: "${brief}"

Requirements:
1. Generate 5-10 markdown files appropriate for the project
2. Each file should have relevant frontmatter fields
3. Include appropriate content structure
4. Use wiki-style links [[filename]] between related files (without .md extension)
5. Vary frontmatter based on content type (blog, docs, portfolio, etc.)

Common frontmatter fields:
- title: string
- date: ISO date string
- slug: url-friendly string
- description: brief summary

Context-specific frontmatter examples:
- Blog: author, tags, category, featured, excerpt
- Portfolio: project_type, mediums, demo_url

Return a JSON array where each object has:
{
  "filename": "about.md",
  "frontmatter": { "title": "About", "category": "pizza", ... },
  "content": "# About\\n\\nThis is the about page..."
}

Make the content engaging and interconnected with wiki links. Ensure filenames are named naturally, spaces are okay.
`;

    let files;

    if (mockMode || !openai) {
      console.log("🧪 Using mock mode (no OpenAI API key provided)...");
      files = getMockFiles(brief);
    } else {
      console.log("🤖 Generating project structure with OpenAI...");

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates structured markdown content for websites and applications. Always respond with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content;

      try {
        // Try to parse the JSON response
        files = JSON.parse(content);
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          files = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse OpenAI response as JSON");
        }
      }

      if (!Array.isArray(files)) {
        throw new Error("OpenAI response is not an array of files");
      }
    }

    console.log(`📝 Creating ${files.length} files...`);

    // Create each file
    const createdFiles = [];
    for (const file of files) {
      const { filename, frontmatter, content: fileContent } = file;

      if (!filename || !frontmatter || !fileContent) {
        console.warn("⚠️  Skipping invalid file structure:", file);
        continue;
      }

      // Create frontmatter string
      const frontmatterStr = Object.entries(frontmatter)
        .map(([key, value]) => {
          if (typeof value === "string") {
            return `${key}: "${value}"`;
          }
          if (Array.isArray(value)) {
            return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
          }
          return `${key}: ${value}`;
        })
        .join("\n");

      const fullContent = `---
${frontmatterStr}
---

${fileContent}
`;

      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, fullContent, "utf8");

      createdFiles.push({
        filename,
        path: filePath,
        frontmatter,
        size: fullContent.length,
      });

      console.log(`✅ Created: ${filename}`);
    }

    // Create a project summary file
    const summaryContent = `---
title: "Project Summary"
date: "${new Date().toISOString()}"
type: "meta"
---

# Project Generated from Brief

**Original Brief:** ${brief}

**Generated Files:** ${createdFiles.length}

## File Structure

${createdFiles.map((f) => `- [${f.filename}](./${f.filename}) (${f.size} bytes)`).join("\n")}

## Generation Details

- **Model:** ${model}
- **Temperature:** ${temperature}
- **Output Directory:** ${outputDir}
- **Generated:** ${new Date().toLocaleString()}

This project was generated using the mdAgent.js tool for the repo.md platform.
`;

    await fs.writeFile(
      path.join(outputDir, "_project-summary.md"),
      summaryContent,
      "utf8"
    );
    createdFiles.push({
      filename: "_project-summary.md",
      path: path.join(outputDir, "_project-summary.md"),
      frontmatter: { title: "Project Summary", type: "meta" },
      size: summaryContent.length,
    });

    console.log("🎉 Project created successfully!");
    console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
    console.log(`📄 Files created: ${createdFiles.length}`);

    return {
      success: true,
      outputDir: path.resolve(outputDir),
      files: createdFiles,
      brief,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error creating project:", error.message);
    throw error;
  }
}

export { createStarterProjectFromBrief };
