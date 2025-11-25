import { listTemplateRepos } from "../lib/github-template.js";
import dotenv from "dotenv";

dotenv.config();

async function testListTemplates() {
  console.log("Testing GitHub template listing...\n");

  const testCases = [
    { owner: "github", type: "org" },
    { owner: "vercel", type: "org" },
  ];

  for (const testCase of testCases) {
    console.log(`\nListing templates for ${testCase.type}: ${testCase.owner}`);
    console.log("-".repeat(50));

    try {
      const result = await listTemplateRepos({
        userToken: process.env.GITHUB_ACCESS_TOKEN,
        owner: testCase.owner,
        type: testCase.type,
      });

      if (result.success) {
        console.log(`Found ${result.templates.length} template(s):`);
        result.templates.forEach((template, index) => {
          console.log(`\n${index + 1}. ${template.name}`);
          console.log(`   Full name: ${template.fullName}`);
          console.log(`   Description: ${template.description || "No description"}`);
          console.log(`   Private: ${template.private}`);
          console.log(`   URL: ${template.htmlUrl}`);
        });
      } else {
        console.error("Error:", result.error);
      }
    } catch (error) {
      console.error("Test failed:", error.message);
    }
  }
}

// Run the test
testListTemplates().catch(console.error);