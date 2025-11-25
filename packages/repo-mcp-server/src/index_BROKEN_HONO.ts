import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod";
import RepoMD from "@repo-md/client";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Repo.md MCP Server",
		version: "0.0.3",
	});

	repoClient: any;

	constructor({ org, projectId }: { org: string; projectId: string }) {
		super();
		
		// Initialize the RepoMD client
		this.repoClient = new RepoMD({
			orgSlug: org,
			projectId: projectId,
			debug: true,
		});
	}

	async init() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
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
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);

		// Get all blog posts from repo
		this.server.tool(
			"getAllBlogPosts",
			{},
			async () => {
				try {
					const posts = await this.repoClient.getAllPosts();
					return {
						content: [{ type: "text", text: JSON.stringify(posts, null, 2) }],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching blog posts: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);
	}
}

// Create a Hono app for routing
const app = new Hono();

// Route with org and projectId parameters
app.get("/org/:org/projects/id/:projectId/sse", async (c) => {
	const { org, projectId } = c.req.param();
	// @ts-ignore
	return MyMCP.serveSSE(`/org/${org}/projects/id/${projectId}/sse`, { org, projectId }).fetch(c.req.raw, c.env, c.executionCtx);
});

// Also handle the SSE message endpoint
app.get("/org/:org/projects/id/:projectId/sse/message", async (c) => {
	const { org, projectId } = c.req.param();
	// @ts-ignore
	return MyMCP.serveSSE(`/org/${org}/projects/id/${projectId}/sse`, { org, projectId }).fetch(c.req.raw, c.env, c.executionCtx);
});

// Legacy routes
app.get("/sse", async (c) => {
	// @ts-ignore
	return MyMCP.serveSSE("/sse", { org: "", projectId: "" }).fetch(c.req.raw, c.env, c.executionCtx);
});

app.get("/sse/message", async (c) => {
	// @ts-ignore
	return MyMCP.serveSSE("/sse", { org: "", projectId: "" }).fetch(c.req.raw, c.env, c.executionCtx);
});

app.get("/mcp", async (c) => {
	// @ts-ignore
	return MyMCP.serve("/mcp", { org: "", projectId: "" }).fetch(c.req.raw, c.env, c.executionCtx);
});

// 404 handler
app.notFound((c) => {
	return c.text("Not found", 404);
});

// Export the fetch handler
export default {
	fetch: app.fetch,
};
