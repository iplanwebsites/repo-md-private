#!/usr/bin/env node
import "dotenv/config";
import { getWeather } from "../lib/llm/tools/weather.js";
import { createTool, responses } from "../lib/llm/tools/baseTool.js";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️ ${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.magenta}🧪${colors.reset} ${msg}`),
  result: (msg, data) => {
    console.log(`${colors.cyan}📊${colors.reset} ${msg}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  },
};

// Mock context for testing
const createMockContext = () => ({
  user: {
    _id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
    permissions: ["read", "write"],
  },
  org: {
    _id: "507f1f77bcf86cd799439012",
    name: "Test Organization",
  },
});

async function testWeatherTool() {
  console.log(colors.bright + "\n🌦️  Weather Tool Test Suite\n" + colors.reset);

  log.info(
    `USE_MOCK_WEATHER_DATA: ${process.env.USE_MOCK_WEATHER_DATA !== "false"}`
  );

  // Get tool info
  console.log("\nTool Info:");
  console.log("Tool object type:", typeof getWeather);
  console.log("Tool object keys:", Object.keys(getWeather));

  // Get the actual tool data
  const toolData = getWeather.toJSON ? getWeather.toJSON() : getWeather;
  console.log("\nTool Definition:");
  console.log(`  Name: ${toolData.definition?.name || "N/A"}`);
  console.log(`  Description: ${toolData.definition?.description || "N/A"}`);
  console.log(
    `  Required Permissions: ${JSON.stringify(
      toolData.requiredPermissions || []
    )}`
  );
  console.log(
    `  Required Context: ${JSON.stringify(toolData.requiredContext || [])}`
  );

  // Test cases
  const testCases = [
    {
      name: "Montreal weather in Celsius",
      args: { location: "Montreal", units: "celsius" },
    },
    {
      name: "New York weather in Fahrenheit",
      args: { location: "New York", units: "fahrenheit" },
    },
    {
      name: "Tokyo weather (default units)",
      args: { location: "Tokyo" },
    },
    {
      name: "Empty location (should handle gracefully)",
      args: { location: "" },
    },
    {
      name: "Invalid units (should use default)",
      args: { location: "Paris", units: "kelvin" },
    },
  ];

  // Run tests
  for (const testCase of testCases) {
    console.log(`\n${colors.bright}Test: ${testCase.name}${colors.reset}`);
    log.test(`Args: ${JSON.stringify(testCase.args)}`);

    try {
      const context = createMockContext();
      // Call the tool's execute method
      const result = await getWeather.execute(testCase.args, context);

      if (result.success) {
        log.success("Tool executed successfully");
        log.result("Result:", result.data);

        // Validate result structure
        if (result.data) {
          const hasExpectedFields = [
            "location",
            "temperature",
            "condition",
          ].every((field) => field in result.data);

          if (hasExpectedFields) {
            log.success("Result has all expected fields");
          } else {
            log.warn("Result missing some expected fields");
          }
        }
      } else {
        log.error(`Tool returned error: ${result.error}`);
        if (result.code) {
          log.error(`Error code: ${result.code}`);
        }
      }
    } catch (error) {
      log.error(`Exception thrown: ${error.message}`);
      console.error(error.stack);
    }
  }

  // Test with different permission contexts
  console.log(`\n${colors.bright}Permission Tests${colors.reset}`);

  const permissionTests = [
    { name: "No permissions", permissions: [] },
    { name: "Read only", permissions: ["read"] },
    { name: "Full permissions", permissions: ["read", "write", "admin"] },
  ];

  for (const test of permissionTests) {
    log.test(`Testing with permissions: ${JSON.stringify(test.permissions)}`);

    const context = createMockContext();
    context.user.permissions = test.permissions;
    context.permissions = test.permissions;

    try {
      const result = await getWeather.execute(
        { location: "London", units: "celsius" },
        context
      );

      if (result.success) {
        log.success("Executed successfully");
      } else {
        log.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      log.error(`Exception: ${error.message}`);
    }
  }

  // Test environment variable behavior
  console.log(`\n${colors.bright}Environment Variable Tests${colors.reset}`);

  // Test with mock data disabled
  process.env.USE_MOCK_WEATHER_DATA = "false";
  log.test("Testing with USE_MOCK_WEATHER_DATA=false");

  const context = createMockContext();
  const result = await getWeather.execute(
    { location: "Berlin", units: "celsius" },
    context
  );

  log.result("Result with real weather mode:", result.data);

  // Reset to mock mode
  delete process.env.USE_MOCK_WEATHER_DATA;
}

// Main function
async function main() {
  try {
    await testWeatherTool();

    console.log(
      `\n${colors.green}${colors.bright}All tests completed!${colors.reset}\n`
    );
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();
