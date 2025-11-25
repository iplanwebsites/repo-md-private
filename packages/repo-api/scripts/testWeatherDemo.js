#!/usr/bin/env node
import "dotenv/config";
import { getWeather } from "../lib/llm/tools/weather.js";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Mock context
const mockContext = {
  user: { _id: "test123", name: "Test User", email: "test@example.com" },
};

async function testWeatherDemo() {
  console.log(colors.bright + "\n🌦️  Weather Tool Demo\n" + colors.reset);

  // Test 1: With mock data
  console.log(colors.blue + "1. Testing with mock data:" + colors.reset);
  process.env.USE_MOCK_WEATHER_DATA = "true";
  
  const mockResult = await getWeather.execute(
    { location: "Paris, France", units: "celsius" },
    mockContext
  );
  
  console.log(colors.cyan + "Mock Result:" + colors.reset);
  console.log(JSON.stringify(mockResult.data, null, 2));

  // Test 2: With real API (Open-Meteo - no key required!)
  console.log(colors.blue + "\n2. Testing with real API (Open-Meteo - FREE, no key needed!):" + colors.reset);
  process.env.USE_MOCK_WEATHER_DATA = "false";
  
  const realResult = await getWeather.execute(
    { location: "Montreal, Canada", units: "celsius" },
    mockContext
  );
  
  if (realResult.success) {
    console.log(colors.green + "✅ Real API Result:" + colors.reset);
    console.log(JSON.stringify(realResult.data, null, 2));
  } else {
    console.log(colors.yellow + "❌ Error:" + colors.reset);
    console.log(realResult.error);
  }
  
  // Test 3: Different location with Fahrenheit
  console.log(colors.blue + "\n3. Testing New York with Fahrenheit:" + colors.reset);
  const nyResult = await getWeather.execute(
    { location: "New York", units: "fahrenheit" },
    mockContext
  );
  
  if (nyResult.success) {
    console.log(colors.green + "✅ Result:" + colors.reset);
    console.log(JSON.stringify(nyResult.data, null, 2));
  } else {
    console.log(colors.yellow + "❌ Error:" + colors.reset);
    console.log(nyResult.error);
  }

  // Test 4: Show how to use in your app
  console.log(colors.blue + "\n4. Example usage in your app:" + colors.reset);
  console.log(`
// In your Slack bot or API endpoint:
const weatherResult = await getWeather.execute(
  { location: "New York, NY", units: "fahrenheit" },
  context
);

if (weatherResult.success) {
  const { temperature, condition, description } = weatherResult.data;
  // Send to Slack: "It's currently {temperature} and {condition} in New York"
}
`);
}

testWeatherDemo().catch(console.error);