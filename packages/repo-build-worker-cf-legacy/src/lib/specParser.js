/**
 * specParser.js - Repository specification parser
 * Handles parsing and processing of repository specification files like REPO.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { openai } from "../services/openaiClient.js";

const DEFAULT_MODEL = "gpt-4.1"; // "gpt-4.1-mini"; // "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8000;

/**
 * Save JSON data to a file in the specified folder
 * @param {string} folder - The folder path
 * @param {string} filename - The filename to save to
 * @param {Object} data - The data to save
 * @param {Object} logger - Logger instance
 * @returns {Promise<string>} - The full file path
 */
async function saveJson(folder, filename, data, logger) {
  const filePath = path.join(folder, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));

  // Use logger if provided, otherwise fall back to console
  if (logger) {
    logger.log(`💾 Saved ${filename} to ${filePath}`);
  } else {
    console.log(`💾 Saved ${filename} to ${filePath}`);
  }

  return filePath;
}

/**
 * Find and read a REPO.md file (case insensitive) from a directory
 * @param {string} repoPath - The repository path to search in
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} - Result with file path and content
 */
async function readRepoMdFile(repoPath, logger) {
  // Look for REPO.md file (case insensitive)
  const repoMdFiles = ["REPO.md", "repo.md", "Repo.md", "REPO.MD"];

  for (const filename of repoMdFiles) {
    const filePath = path.join(repoPath, filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (logger) {
        logger.log(`📋 Found ${filename} at ${filePath}`);
      } else {
        console.log(`📋 Found ${filename} at ${filePath}`);
      }
      return {
        found: true,
        filePath: filePath,
        content: content,
        filename: filename,
      };
    } catch (error) {
      // File doesn't exist, continue to next
    }
  }

  if (logger) {
    logger.log("⚠️ No REPO.md file found");
  } else {
    console.log("⚠️ No REPO.md file found");
  }

  return { found: false };
}

/**
 * Process markdown content using LLM to generate structured JSON
 * @param {string} markdownContent - The markdown content to process
 * @param {string} sourceFile - Source file path for metadata
 * @param {Object} logger - Logger instance
 * @param {string} model - The model to use for processing
 * @returns {Promise<Object>} - Generated JSON object
 */
async function processMarkdownWithLLM(
  markdownContent,
  sourceFile = null,
  logger = null,
  model = DEFAULT_MODEL
) {
  if (logger) {
    logger.log("🤖 Processing markdown content with LLM...");
  } else {
    console.log("🤖 Processing markdown content with LLM...");
  }

  // Create prompt for LLM to generate structured JSON from markdown
  const systemPrompt = `You are an expert at analyzing AI agent specifications and extracting structured metadata. You understand the AI Agent Content Project Specification Framework deeply.

## Background Context

AI Agent specifications define autonomous content-generating agents that can:
- Create and publish content (blogs, exhibitions, documentation)
- Interact with users through a public-facing persona
- Self-manage their work through scheduled or triggered actions
- Use various tools (web search, image generation, file operations)

The specification framework has these key sections:
1. **Summary**: Core mission and purpose
2. **Content**: How content is structured, written, and visualized
3. **Agent Actions/Roles**: What the agent can do (not job titles, but executable tasks)
4. **Agent Tools**: Technical capabilities like web_search, image_generation
5. **Self-Management**: When and how actions are triggered
6. **Public Persona**: How the agent interacts with end users

## Your Task

Analyze the provided specification document and generate a comprehensive JSON object that:

1. **Extracts and consolidates** scattered information about the same topic
2. **Evaluates quality** (0-10 scale) for each section based on:
   - Completeness of information
   - Clarity of instructions
   - Practical implementability
   - Specificity vs vagueness
   
3. **Preserves original text** in an "original" field (use "..." for long truncations)

4. **Generates a system prompt** for the public persona combining personality and boundaries

5. **Provides actionable feedback** identifying gaps and suggesting improvements

## JSON Structure Requirements

The output JSON must include these sections:

### metadata
- project_name: Extract from document
- processed_date: Current ISO timestamp
- spec_version: Default "1.0"

### summary
- description: One-paragraph project overview
- quality_score: 0-10
- original: Source text excerpt

### content_strategy
- voice: How content reads (tone, style, principles)
- structure: Content types, file organization, templates
- visual_style: Image guidelines, formats, generation rules
- Each with: description, quality_score, details object, original

### actions
Array of executable tasks/workflows with:
- title: Action name
- summary: One-line description
- detailed_description: Full workflow explanation
- quality_score: 0-10
- phases: If multi-phase, break down each phase
- original: Source text

### tools
- description: Overall tool usage
- quality_score: 0-10
- primary_tools: Array of {name, usage} objects
- original: Source text

### automation
- description: How agent self-manages
- quality_score: 0-10 or "NA" if missing
- patterns: Array of {name, trigger, action, output}
- original: Source text or "Not specified"

### public_persona
- personality: Description, traits, example responses
- boundaries: What agent handles vs deflects
- system_prompt: Generated prompt for the persona
- quality_score: 0-10 or "NA" if missing
- original: Source text or "Not specified"

### validation
- overall_quality: Average of section scores
- section_scores: Object with each section's score
- strengths: Array of what's done well
- missing_elements: Array of expected but missing items

### feedback
- recommendations: Array of {section, issue, suggestion} objects
- overall_feedback: Paragraph summarizing strengths and key improvements

## Quality Scoring Guidelines

- 10: Exceptional detail, clear examples, immediately implementable
- 8-9: Very good, minor gaps or clarifications needed
- 6-7: Adequate but needs expansion or clarity
- 4-5: Basic framework present but significant gaps
- 2-3: Minimal information, needs major work
- 0-1: Missing or unusable
- NA: Section not applicable to this project type

## Important Extraction Rules

1. **Consolidate scattered information**: If content strategy details appear in multiple sections, combine them
2. **Infer from context**: If something isn't explicitly stated but clearly implied, include it with a note
3. **Preserve specificity**: Keep specific examples, file paths, formats
4. **Flag ambiguity**: If instructions are vague, note this in feedback
5. **Extract hidden details**: Pull out workflow details even if buried in prose

## Common Pitfalls to Avoid

- Don't confuse "Agent Roles/Actions" with job roles - these are executable tasks
- Don't mix "tools" (technical capabilities) with "actions" (complex workflows)
- Don't overlook multi-phase workflows - break them down
- Don't ignore file structure and naming conventions
- Don't miss automation triggers and patterns

Respond with ONLY valid JSON, no other text, markdown formatting, or code blocks.`;

  // Define the complete schema for agent specification extraction
  const AgentSpecificationSchema = z.object({
    metadata: z.object({
      project_name: z.string(),
      processed_date: z.string(), // ISO timestamp
      spec_version: z.string().default("1.0"),
    }),

    summary: z.object({
      description: z.string(),
      quality_score: z.number().min(0).max(10),
      original: z.string(),
    }),

    content_strategy: z.object({
      voice: z.object({
        description: z.string(),
        quality_score: z.number().min(0).max(10),
        details: z.object({
          tone: z.string(),
          style: z.string(),
          principles: z.array(z.string()),
        }),
        original: z.string().nullable(),
      }),
      structure: z.object({
        description: z.string(),
        quality_score: z.number().min(0).max(10),
        content_types: z.array(
          z.object({
            name: z.string(),
            path: z.string(),
            includes: z.array(z.string()),
          })
        ),
        original: z.string().nullable(),
      }),
      visual_style: z.object({
        description: z.string(),
        quality_score: z.number().min(0).max(10),
        details: z.object({
          formats: z.array(z.string()),
          technical_requirements: z.array(z.string()),
          prompt_structure: z.array(z.string()).nullable(),
        }),
        original: z.string().nullable(),
      }),
    }),

    actions: z.array(
      z.object({
        title: z.string(),
        summary: z.string(),
        detailed_description: z.string(),
        quality_score: z.number().min(0).max(10),
        phases: z
          .array(
            z.object({
              name: z.string(),
              tasks: z.array(z.string()),
              output: z.string(),
            })
          )
          .nullable(),
        original: z.string(),
      })
    ),

    tools: z.object({
      description: z.string(),
      quality_score: z.number().min(0).max(10),
      primary_tools: z.array(
        z.object({
          name: z.string(),
          usage: z.string(),
        })
      ),
      original: z.string(),
    }),

    automation: z.object({
      description: z.string(),
      quality_score: z.union([z.number().min(0).max(10), z.literal("NA")]),
      patterns: z.array(
        z.object({
          name: z.string(),
          trigger: z.string(),
          action: z.string(),
          output: z.string(),
        })
      ),
      original: z.string(),
    }),

    public_persona: z.object({
      personality: z.object({
        description: z.string(),
        quality_score: z.union([z.number().min(0).max(10), z.literal("NA")]),
        traits: z.array(z.string()),
        example_responses: z.array(z.string()),
      }),
      boundaries: z.object({
        handles: z.array(z.string()),
        deflects: z.array(z.string()),
        quality_score: z.union([z.number().min(0).max(10), z.literal("NA")]),
      }),
      system_prompt: z.string(),
      original: z.string(),
    }),

    validation: z.object({
      overall_quality: z.number().min(0).max(10),
      section_scores: z.object({
        summary: z.number().min(0).max(10),
        content_strategy: z.number().min(0).max(10),
        actions: z.number().min(0).max(10),
        tools: z.number().min(0).max(10),
        automation: z.union([z.number().min(0).max(10), z.literal("NA")]),
        public_persona: z.union([z.number().min(0).max(10), z.literal("NA")]),
      }),
      strengths: z.array(z.string()),
      missing_elements: z.array(z.string()),
    }),

    feedback: z.object({
      recommendations: z.array(
        z.object({
          section: z.string(),
          issue: z.string(),
          suggestion: z.string(),
        })
      ),
      overall_feedback: z.string(),
    }),
  });

  const user = `Analyze this AI agent specification and generate the structured JSON:
\`\`\`
${markdownContent}
\`\`\`
`;

  // Call OpenAI API to generate structured JSON using responses API
  const response = await openai.responses.create({
    model: model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: user,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(AgentSpecificationSchema, "agent_specification"),

      // format: {  type: "json_object",  },
    },
    reasoning: {},
    tools: [],
    temperature: DEFAULT_TEMPERATURE,
    max_output_tokens: DEFAULT_MAX_TOKENS,
    top_p: 1,
    store: true,
  });

  const jsonContent = response.output[0].content[0].text.trim();

  // Debug: Log raw response for troubleshooting
  if (logger) {
    logger.log(`🔍 Raw LLM response length: ${jsonContent.length} characters`);
    logger.log(`🔍 Response preview: ${jsonContent.substring(0, 200)}...`);
    logger.log(
      `🔍 Response ends with: ...${jsonContent.substring(Math.max(0, jsonContent.length - 100))}`
    );
  } else {
    console.log(`🔍 Raw LLM response length: ${jsonContent.length} characters`);
    console.log(`🔍 Response preview: ${jsonContent.substring(0, 200)}...`);
    console.log(
      `🔍 Response ends with: ...${jsonContent.substring(Math.max(0, jsonContent.length - 100))}`
    );
  }

  // Parse and validate the JSON response
  let repoJson;
  try {
    repoJson = JSON.parse(jsonContent);
  } catch (parseError) {
    // Log the full response for debugging if it's not too long
    const responseToLog =
      jsonContent.length < 2000
        ? jsonContent
        : jsonContent.substring(0, 1000) +
          "\n... [TRUNCATED] ...\n" +
          jsonContent.substring(jsonContent.length - 500);

    if (logger) {
      logger.error(`Failed to parse LLM response as JSON. Full response:`, {
        response: responseToLog,
      });
    } else {
      console.error(
        `Failed to parse LLM response as JSON. Full response:`,
        responseToLog
      );
    }

    throw new Error(
      `Failed to parse LLM response as JSON: ${parseError.message}. Response length: ${jsonContent.length} chars`
    );
  }

  // Add metadata about the generation
  repoJson._metadata = {
    generatedAt: new Date().toISOString(),
    //  sourceFile: sourceFile, // will always be Repo.md, since we go one per folder...
    generatedBy: "repo-build-worker",
    model: model,
  };

  // Add the original markdown content
  repoJson.original = markdownContent;

  if (logger) {
    logger.log("✅ LLM processing completed successfully");
  } else {
    console.log("✅ LLM processing completed successfully");
  }

  return repoJson;
}

/**
 * Generate REPO.json from REPO.md file using LLM
 * @param {string} repoPath - The repository path
 * @param {string} distFolder - The distribution folder path
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} - Result with REPO.json path
 */
async function generateRepoJson(repoPath, distFolder, logger) {
  try {
    // Read the REPO.md file
    const fileResult = await readRepoMdFile(repoPath, logger);

    if (!fileResult.found) {
      if (logger) {
        logger.log("⚠️ Skipping REPO.json generation - no REPO.md file found");
      } else {
        console.log("⚠️ Skipping REPO.json generation - no REPO.md file found");
      }
      return { repoJsonGenerated: false };
    }

    // Process the content with LLM
    const repoJson = await processMarkdownWithLLM(
      fileResult.content,
      fileResult.filePath,
      logger
    );

    // Save REPO.json to dist folder
    const repoJsonPath = await saveJson(
      distFolder,
      "REPO.json",
      repoJson,
      logger
    );

    if (logger) {
      logger.log(`✅ REPO.json generated successfully at ${repoJsonPath}`);
    } else {
      console.log(`✅ REPO.json generated successfully at ${repoJsonPath}`);
    }

    return {
      repoJsonGenerated: true,
      repoJsonPath: repoJsonPath,
      sourceFile: fileResult.filePath,
    };
  } catch (error) {
    if (logger) {
      logger.error(`❌ Failed to generate REPO.json: ${error.message}`);
    } else {
      console.error(`❌ Failed to generate REPO.json: ${error.message}`);
    }

    // Return error info but don't throw - make this step optional
    return {
      repoJsonGenerated: false,
      error: error.message,
    };
  }
}

export { generateRepoJson, readRepoMdFile, processMarkdownWithLLM };
