#!/usr/bin/env node
import "dotenv/config";
import { connectToDB } from "../db.js";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { getWeather } from "../lib/llm/tools/weather.js";
import {
  createTool,
  responses,
  validators,
} from "../lib/llm/tools/baseTool.js";

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
  result: (msg) => console.log(`${colors.cyan}📊${colors.reset} ${msg}`),
};

// Mock context for testing
const createMockContext = (overrides = {}) => ({
  user: {
    _id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
    permissions: ["read", "write"],
    ...overrides.user,
  },
  org: {
    _id: "507f1f77bcf86cd799439012",
    name: "Test Organization",
    ...overrides.org,
  },
  project: {
    _id: "507f1f77bcf86cd799439013",
    name: "Test Project",
    ...overrides.project,
  },
  session: {
    id: "test-session-123",
    type: "test",
  },
  auth: true,
  permissions: ["read", "write"],
  ...overrides,
});

async function testIndividualTool(tool, testCases) {
  log.test(`Testing tool: ${tool.definition.name}`);
  console.log(`  Description: ${tool.definition.description}`);
  console.log(`  Required permissions: ${tool.requiredPermissions || "none"}`);
  console.log(`  Required context: ${tool.requiredContext || "none"}`);

  for (const testCase of testCases) {
    console.log(`\n  Test case: ${testCase.name}`);

    try {
      const context = createMockContext(testCase.contextOverrides || {});
      const result = await tool.implementation(testCase.args, context);

      if (result.success) {
        log.success(`Tool executed successfully`);
        log.result(`Result: ${JSON.stringify(result, null, 2)}`);
      } else {
        log.error(`Tool returned error: ${result.error}`);
      }

      // Run assertions if provided
      if (testCase.assertions) {
        for (const assertion of testCase.assertions) {
          if (assertion(result)) {
            log.success(`Assertion passed: ${assertion.name || "unnamed"}`);
          } else {
            log.error(`Assertion failed: ${assertion.name || "unnamed"}`);
          }
        }
      }
    } catch (error) {
      log.error(`Exception thrown: ${error.message}`);
      console.error(error.stack);
    }
  }
}

async function testWeatherTool() {
  console.log(
    "\n" + colors.bright + "=== Testing Weather Tool ===" + colors.reset + "\n"
  );

  const testCases = [
    {
      name: "Basic weather query (Montreal, celsius)",
      args: { location: "Montreal", units: "celsius" },
      assertions: [
        Object.assign((result) => result.success === true, {
          name: "Should succeed",
        }),
        Object.assign((result) => result.data?.location === "Montreal", {
          name: "Should return correct location",
        }),
        Object.assign((result) => result.data?.temperature?.includes("°C"), {
          name: "Should use celsius",
        }),
      ],
    },
    {
      name: "Weather query (New York, fahrenheit)",
      args: { location: "New York, NY", units: "fahrenheit" },
      assertions: [
        Object.assign((result) => result.success === true, {
          name: "Should succeed",
        }),
        Object.assign((result) => result.data?.temperature?.includes("°F"), {
          name: "Should use fahrenheit",
        }),
      ],
    },
    {
      name: "Default units test",
      args: { location: "London" },
      assertions: [
        Object.assign((result) => result.success === true, {
          name: "Should succeed",
        }),
        Object.assign((result) => result.data?.temperature?.includes("°F"), {
          name: "Should default to fahrenheit",
        }),
      ],
    },
    {
      name: "Missing required parameter",
      args: {},
      assertions: [
        Object.assign((result) => result !== undefined, {
          name: "Should return a result",
        }),
      ],
    },
  ];

  await testIndividualTool(getWeather, testCases);
}

async function testToolIntegration() {
  console.log(
    "\n" +
      colors.bright +
      "=== Testing Tool Integration with EditorChat ===" +
      colors.reset +
      "\n"
  );

  try {
    await connectToDB();
    log.success("Connected to database");

    const mockUser = {
      _id: "507f1f77bcf86cd799439011",
      name: "Test User",
      permissions: ["read", "write"],
    };

    const mockOrg = {
      _id: "507f1f77bcf86cd799439012",
      name: "Test Organization",
    };

    const mockProject = {
      _id: "507f1f77bcf86cd799439013",
      name: "Test Project",
      members: [
        {
          userId: mockUser._id,
          role: "owner",
        },
      ],
    };

    // Test with GENERALIST archetype
    const chatHandler = new EditorChatHandler({
      user: mockUser,
      org: mockOrg,
      project: mockProject,
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false,
      agentArchetype: "GENERALIST",
      debug: true,
    });

    await chatHandler.initialize();
    log.success("Chat handler initialized");

    // Check available tools
    console.log("\nAvailable tools:");
    chatHandler.tools.forEach((tool, index) => {
      console.log(
        `  [${index}] ${tool.function?.name}: ${tool.function?.description}`
      );
    });

    // Test tool execution directly
    log.test("\nTesting direct tool execution...");
    const weatherResult = await chatHandler.executeTools([
      {
        id: "test-call-1",
        type: "function",
        function: {
          name: "getWeather",
          arguments: JSON.stringify({ location: "Montreal", units: "celsius" }),
        },
      },
    ]);

    console.log(
      "Tool execution result:",
      JSON.stringify(weatherResult, null, 2)
    );

    // Test through chat
    log.test("\nTesting tool execution through chat...");
    const queries = [
      "What's the weather in Montreal?",
      "How's the weather in Tokyo in celsius?",
      "Tell me about the weather in London",
    ];

    for (const query of queries) {
      log.info(`Query: "${query}"`);
      try {
        const response = await chatHandler.sendMessage(query);
        log.success(`Response: ${response.content}`);
      } catch (error) {
        log.error(`Chat error: ${error.message}`);
      }
    }
  } catch (error) {
    log.error(`Integration test failed: ${error.message}`);
    console.error(error.stack);
  }
}

async function createAndTestCustomTool() {
  console.log(
    "\n" +
      colors.bright +
      "=== Testing Custom Tool Creation ===" +
      colors.reset +
      "\n"
  );

  // Create a simple calculator tool
  const calculator = createTool({
    definition: {
      name: "calculator",
      description: "Perform basic arithmetic operations",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
            description: "The operation to perform",
          },
          a: {
            type: "number",
            description: "First operand",
          },
          b: {
            type: "number",
            description: "Second operand",
          },
        },
        required: ["operation", "a", "b"],
      },
    },
    implementation: async (args, context) => {
      const { operation, a, b } = args;

      let result;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            return responses.error("Cannot divide by zero", "DIVISION_BY_ZERO");
          }
          result = a / b;
          break;
        default:
          return responses.error(
            `Unknown operation: ${operation}`,
            "INVALID_OPERATION"
          );
      }

      return responses.success(
        {
          operation,
          a,
          b,
          result,
          expression: `${a} ${operation} ${b} = ${result}`,
        },
        `Calculated ${operation} of ${a} and ${b}`
      );
    },
    category: "utilities",
    requiredPermissions: [],
    requiredContext: ["user"],
    costEstimate: "low",
  });

  const testCases = [
    {
      name: "Addition",
      args: { operation: "add", a: 5, b: 3 },
      assertions: [
        Object.assign((result) => result.data?.result === 8, {
          name: "Should correctly add numbers",
        }),
      ],
    },
    {
      name: "Division by zero",
      args: { operation: "divide", a: 10, b: 0 },
      assertions: [
        Object.assign((result) => result.success === false, {
          name: "Should fail on division by zero",
        }),
        Object.assign((result) => result.code === "DIVISION_BY_ZERO", {
          name: "Should return correct error code",
        }),
      ],
    },
  ];

  await testIndividualTool(calculator, testCases);
}

async function main() {
  console.log(colors.bright + "\n🔧 Tool Testing Suite\n" + colors.reset);

  // Set environment for testing
  process.env.USE_MOCK_WEATHER_DATA = "true";
  log.info(`USE_MOCK_WEATHER_DATA: ${process.env.USE_MOCK_WEATHER_DATA}`);

  try {
    // Test individual tools
    await testWeatherTool();
    await createAndTestCustomTool();

    // Test integration
    await testToolIntegration();

    log.success("\nAll tests completed!");
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run tests
main();
