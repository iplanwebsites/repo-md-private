# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` or `npm start` - Start development server with Wrangler
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run format` - Format code with Biome
- `npm run lint:fix` - Run Biome linter and auto-fix issues
- `npm run cf-typegen` - Generate TypeScript types for Cloudflare Workers

## Code Style Guidelines

- **Formatting**: 2-space indentation, 100 character line width (enforced by Biome)
- **Imports**: Use ES modules, organize imports automatically with Biome
- **Types**: Use strict TypeScript typing, use Zod for runtime validation
- **Error Handling**: Explicit error messages, handle edge cases like division by zero
- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **Comments**: Document complex logic and tool functionality
- **Tools**: Create MCP tools with clear parameter schemas using Zod

## Architecture

- Based on Model Context Protocol (MCP) for implementing AI agent tools
- Implemented as Cloudflare Workers for serverless deployment
- Serves endpoints at /sse and /mcp for different client connections
