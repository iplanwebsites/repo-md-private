#!/usr/bin/env node

import dotenv from 'dotenv';
import { createStarterProjectFromBrief } from "../src/lib/mdAgent.js";
import path from "node:path";

// Load environment variables from .env file
dotenv.config();

async function testProjectGenerator() {
  console.log("🧪 Testing Project Starter Generator\n");

  const testCases = [
    {
      name: "Personal Blog",
      brief:
        "Create a personal blog about web development with posts about React, Node.js, and deployment best practices. Include an about page and contact information.",
      outputDir: "./test-starter/blog",
    },
    {
      name: "Product Documentation",
      brief:
        "Build documentation for a SaaS API product including getting started guide, API reference, tutorials, and troubleshooting section.",
      outputDir: "./test-starter/docs",
    },
    {
      name: "Portfolio Site",
      brief:
        "Create a developer portfolio showcasing full-stack projects, skills, experience, and a blog section for technical articles.",
      outputDir: "./test-starter/portfolio",
    },
    {
      name: "E-commerce Store",
      brief:
        "Design an online store for handmade crafts with product categories, featured items, about the artisan, and shipping information.",
      outputDir: "./test-starter/ecommerce",
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];

    console.log(`\n🔄 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`📝 Brief: ${testCase.brief}`);
    console.log(`📁 Output: ${testCase.outputDir}`);

    try {
      const result = await createStarterProjectFromBrief(testCase.brief, {
        outputDir: testCase.outputDir,
        temperature: 0.8,
        model: "gpt-4",
      });

      console.log(`✅ Success! Created ${result.files.length} files`);
      console.log(
        `📄 Files: ${result.files.map((f) => f.filename).join(", ")}`
      );
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }

    // Add a small delay between requests
    if (i < testCases.length - 1) {
      console.log("⏳ Waiting 2 seconds before next test...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n🎯 All tests completed!");
  console.log("\n📂 Check the following directories for generated content:");
  for (const tc of testCases) {
    console.log(`   - ${path.resolve(tc.outputDir)}`);
  }
}

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Error: OPENAI_API_KEY environment variable is required");
  console.log("💡 Set it by running: export OPENAI_API_KEY=your_api_key_here");
  process.exit(1);
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testProjectGenerator().catch((error) => {
    console.error("❌ Test runner failed:", error);
    process.exit(1);
  });
}

export { testProjectGenerator };
