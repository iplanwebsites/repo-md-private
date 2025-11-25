import { createTool, responses } from "./baseTool.js";
import https from "https";

// Note: Mock data flag is checked at runtime to allow dynamic switching

// Simple weather tool for testing tool integration
const getWeather = createTool({
  definition: {
    name: "getWeather",
    description: "Get weather information for a specific location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description:
            'The city and state/country, e.g. "Miami, FL" or "London, UK"',
        },
        units: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature units (default: fahrenheit)",
          default: "fahrenheit",
        },
      },
      required: ["location"],
    },
  },
  implementation: async (args, context) => {
    const { location, units = "fahrenheit" } = args;

    if (process.env.USE_MOCK_WEATHER_DATA === 'true') {
      // Always return thunderstorm and 50°C/122°F for testing
      const temp = units === "celsius" ? 50 : 122;
      const unit = units === "celsius" ? "°C" : "°F";

      return responses.success(
        {
          location: location,
          temperature: `${temp}${unit}`,
          condition: "Thunderstorm",
          humidity: "90%",
          wind: "25 mph NE",
          forecast: "Severe thunderstorms with heavy rain and lightning",
          warning: "Extreme heat warning in effect",
          note: "This is mocked weather data for testing",
        },
        `Weather information retrieved for ${location}`
      );
    }

    // Real weather implementation using Open-Meteo API (no API key required)
    try {
      // First, geocode the location to get coordinates
      const geoData = await geocodeLocation(location);
      if (!geoData) {
        return responses.error(`Location "${location}" not found`);
      }
      
      // Fetch weather data using coordinates
      const weatherData = await fetchWeatherData(geoData.latitude, geoData.longitude, units);
      
      return responses.success(
        {
          location: `${geoData.name}, ${geoData.country}`,
          temperature: `${weatherData.temperature}°${units === 'celsius' ? 'C' : 'F'}`,
          condition: weatherData.condition,
          description: weatherData.description,
          humidity: `${weatherData.humidity}%`,
          wind: `${weatherData.windSpeed} mph`,
          pressure: `${weatherData.pressure} hPa`,
          feels_like: `${weatherData.feelsLike}°${units === 'celsius' ? 'C' : 'F'}`,
          precipitation: `${weatherData.precipitation} mm`
        },
        `Weather information retrieved for ${location}`
      );
    } catch (error) {
      return responses.error(
        `Failed to fetch weather data: ${error.message}`
      );
    }
  },
  category: "utilities",
  requiredPermissions: [],
  requiredContext: ["user"],
  rateLimit: { requests: 30, window: "1m" },
  costEstimate: "low",
});

// Helper function to geocode location using Open-Meteo Geocoding API
function geocodeLocation(location) {
  return new Promise((resolve, reject) => {
    const encodedLocation = encodeURIComponent(location);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedLocation}&count=1&language=en&format=json`;
    
    https.get(url, (resp) => {
      let data = '';
      
      resp.on('data', (chunk) => {
        data += chunk;
      });
      
      resp.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.results && parsedData.results.length > 0) {
            const result = parsedData.results[0];
            resolve({
              name: result.name,
              country: result.country,
              latitude: result.latitude,
              longitude: result.longitude
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(new Error('Failed to parse geocoding data'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to fetch weather data from Open-Meteo API
function fetchWeatherData(latitude, longitude, units) {
  return new Promise((resolve, reject) => {
    const tempUnit = units === 'celsius' ? 'celsius' : 'fahrenheit';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m&temperature_unit=${tempUnit}&wind_speed_unit=mph`;
    
    https.get(url, (resp) => {
      let data = '';
      
      resp.on('data', (chunk) => {
        data += chunk;
      });
      
      resp.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          const current = parsedData.current;
          
          // Map weather codes to conditions
          const weatherCondition = getWeatherCondition(current.weather_code);
          
          resolve({
            temperature: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature),
            humidity: current.relative_humidity_2m,
            windSpeed: Math.round(current.wind_speed_10m),
            pressure: Math.round(current.surface_pressure),
            precipitation: current.precipitation,
            condition: weatherCondition.condition,
            description: weatherCondition.description
          });
        } catch (e) {
          reject(new Error('Failed to parse weather data'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Map Open-Meteo weather codes to readable conditions
function getWeatherCondition(code) {
  const weatherCodes = {
    0: { condition: 'Clear', description: 'Clear sky' },
    1: { condition: 'Mostly Clear', description: 'Mainly clear' },
    2: { condition: 'Partly Cloudy', description: 'Partly cloudy' },
    3: { condition: 'Overcast', description: 'Overcast' },
    45: { condition: 'Foggy', description: 'Fog' },
    48: { condition: 'Foggy', description: 'Depositing rime fog' },
    51: { condition: 'Drizzle', description: 'Light drizzle' },
    53: { condition: 'Drizzle', description: 'Moderate drizzle' },
    55: { condition: 'Drizzle', description: 'Dense drizzle' },
    61: { condition: 'Rain', description: 'Slight rain' },
    63: { condition: 'Rain', description: 'Moderate rain' },
    65: { condition: 'Rain', description: 'Heavy rain' },
    71: { condition: 'Snow', description: 'Slight snow fall' },
    73: { condition: 'Snow', description: 'Moderate snow fall' },
    75: { condition: 'Snow', description: 'Heavy snow fall' },
    77: { condition: 'Snow', description: 'Snow grains' },
    80: { condition: 'Rain Showers', description: 'Slight rain showers' },
    81: { condition: 'Rain Showers', description: 'Moderate rain showers' },
    82: { condition: 'Rain Showers', description: 'Violent rain showers' },
    85: { condition: 'Snow Showers', description: 'Slight snow showers' },
    86: { condition: 'Snow Showers', description: 'Heavy snow showers' },
    95: { condition: 'Thunderstorm', description: 'Thunderstorm' },
    96: { condition: 'Thunderstorm', description: 'Thunderstorm with slight hail' },
    99: { condition: 'Thunderstorm', description: 'Thunderstorm with heavy hail' }
  };
  
  return weatherCodes[code] || { condition: 'Unknown', description: 'Unknown weather condition' };
}

// Export the weather tool directly as named export
export { getWeather };

// Also export as default for compatibility
export default {
  getWeather,
};
