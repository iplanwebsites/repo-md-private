import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {RepoMD} from "@repo-md/client";

// Cache for RepoMD instances per project
const repoInstances = new Map<string, RepoMD>();

// Function to get or create RepoMD instance for a project
function getRepoInstance(projectId: string): RepoMD {
	if (!repoInstances.has(projectId)) {
		const repo = new RepoMD({
			//orgSlug: "iplanwebsites",
			//orgId: null,
			//projectSlug: "port1g", // You might want to make this dynamic too
			projectId: projectId,
			debug: true,
		});
		repoInstances.set(projectId, repo);
	}
	return repoInstances.get(projectId)!;
}

// Define our MCP server class - simplified without extending McpAgent
export class ProjectMCPServer {
	server: McpServer;
	repo: RepoMD;
	projectId: string;

	constructor(projectId: string) {
		this.projectId = projectId;
		this.repo = getRepoInstance(projectId);
		this.server = new McpServer({
			name: `mc4-project-${projectId}`,
			version: "0.0.4",
		});
		this.setupTools();
	}

	private setupTools() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Debug tool - returns context information including project ID
		this.server.tool(
			"getProjectInfo",
			{},
			async (_args, context) => {
				const debugInfo = {
					timestamp: new Date().toISOString(),
					projectId: this.repo.projectId,
					orgSlug: this.repo.orgSlug,
					context: context,
					args: _args,
				};
				
				return {
					content: [{ 
						type: "text", 
						text: 'PROJECT INFO: ' + JSON.stringify(debugInfo, null, 2)
					}]
				};
			} 
		);

		// Get all posts tool
		this.server.tool(
			"getAllPosts",
			{},
			async () => {
				try {
					const posts = await this.repo.getAllPosts();
					return {
						content: [{ 
							type: "text", 
							text: JSON.stringify(posts, null, 2)
						}]
					};
				} catch (error) {
					return {
						content: [{ 
							type: "text", 
							text: `Error fetching posts: ${error.message}`
						}]
					};
				}
			}
		);

		// Get single post tool
		this.server.tool(
			"getPostById",
			{ id: z.string() },
			async ({ id }) => {
				try {
					const post = await this.repo.getPostById(id);
					return {
						content: [{ 
							type: "text", 
							text: post ? JSON.stringify(post, null, 2) : "Post not found"
						}]
					};
				} catch (error) {
					return {
						content: [{ 
							type: "text", 
							text: `Error fetching post: ${error.message}`
						}]
					};
				}
			}
		);

		// Get project metadata
		this.server.tool(
			"getProjectMetadata",
			{},
			async () => {
				try {
					const metadata = await this.repo.getProjectMetadata();
					return {
						content: [{ 
							type: "text", 
							text: JSON.stringify(metadata, null, 2)
						}]
					};
				} catch (error) {
					return {
						content: [{ 
							type: "text", 
							text: `Error fetching project metadata: ${error.message}`
						}]
					};
				}
			}
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
	}

	// Handle MCP requests
	async handleMCP(request: Request): Promise<Response> {
		try {
			// Handle CORS preflight requests
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
						'Access-Control-Allow-Headers': '*',
						'Access-Control-Allow-Credentials': 'true',
						'Access-Control-Max-Age': '1000',
					},
				});
			}

			// Handle the MCP protocol request
			const response = await this.server.fetch(request);
			
			// Add CORS headers to the response
			const newResponse = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: {
					...Object.fromEntries(response.headers),
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				},
			});

			return newResponse;
		} catch (error) {
			console.error('MCP handling error:', error);
			return new Response(JSON.stringify({ 
				error: 'MCP server error', 
				message: error.message 
			}), {
				status: 500,
				headers: { 
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Headers': '*',
					'Access-Control-Allow-Credentials': 'true',
				},
			});
		}
	}

	// Handle SSE requests  
	async handleSSE(request: Request): Promise<Response> {
		try {
			// Handle CORS preflight
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
						'Access-Control-Allow-Headers': '*',
					'Access-Control-Allow-Credentials': 'true',
					},
				});
			}

			// Create a simple SSE response for testing
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					// Send initial connection message
					controller.enqueue(encoder.encode('data: {"type":"connection","status":"connected","projectId":"' + this.projectId + '"}\n\n'));
					
					// Send a test message
					controller.enqueue(encoder.encode('data: {"type":"info","message":"SSE connection established for project ' + this.projectId + '"}\n\n'));
					
					// Send periodic pings to keep connection alive
					const interval = setInterval(() => {
						try {
							controller.enqueue(encoder.encode('data: {"type":"ping","timestamp":"' + new Date().toISOString() + '"}\n\n'));
						} catch (error) {
							clearInterval(interval);
							controller.close();
						}
					}, 5000);

					// Clean up on abort
					request.signal?.addEventListener('abort', () => {
						clearInterval(interval);
						controller.close();
					});
				}
			});

			return new Response(stream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Headers': '*',
					'Access-Control-Allow-Credentials': 'true',
				},
			});
		} catch (error) {
			console.error('SSE handling error:', error);
			return new Response(JSON.stringify({ 
				error: 'SSE server error', 
				message: error.message 
			}), {
				status: 500,
				headers: { 
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Headers': '*',
					'Access-Control-Allow-Credentials': 'true',
				},
			});
		}
	}
}

// Cache for MCP server instances per project
const mcpInstances = new Map<string, ProjectMCPServer>();

// Function to get or create MCP server instance for a project
function getMcpInstance(projectId: string): ProjectMCPServer {
	if (!mcpInstances.has(projectId)) {
		const mcp = new ProjectMCPServer(projectId);
		mcpInstances.set(projectId, mcp);
	}
	return mcpInstances.get(projectId)!;
}

// Helper function to extract project ID from path
function extractProjectId(pathname: string): string | null {
	const match = pathname.match(/^\/projects\/([^\/]+)/);
	return match ? match[1] : null;
}

// Helper function to get the endpoint type from path
function getEndpointType(pathname: string, projectId: string): string | null {
	const basePath = `/projects/${projectId}`;
	if (pathname === `${basePath}/mcp`) return "mcp";
	if (pathname === `${basePath}/sse`) return "sse";
	if (pathname === `${basePath}/sse/message`) return "sse-message";
	if (pathname === `${basePath}/debug`) return "debug";
	if (pathname === `${basePath}/test`) return "test";
	return null;
}

// Export MyMCP as alias for backward compatibility with Durable Objects
export const MyMCP = ProjectMCPServer;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		
		// Extract project ID from path
		const projectId = extractProjectId(url.pathname);
		
		if (!projectId) {
			// Handle root path - show available endpoints
			if (url.pathname === "/") {
				const info = {
					message: "Project-based MCP Server",
					usage: "Use /projects/{projectId}/{endpoint}",
					endpoints: [
						"/projects/{projectId}/mcp - Main MCP endpoint",
						"/projects/{projectId}/sse - Server-Sent Events endpoint", 
						"/projects/{projectId}/sse/message - SSE message endpoint",
						"/projects/{projectId}/test - Test endpoint to verify server setup",
						"/projects/{projectId}/debug - Debug information"
					],
					example: "/projects/680e97604a0559a192640d2c/mcp"
				};
				return new Response(JSON.stringify(info, null, 2), {
					status: 200,
					headers: { 
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Headers": "*",
						"Access-Control-Allow-Credentials": "true",
					}
				});
			}
			
			return new Response("Invalid path. Use /projects/{projectId}/{endpoint}", { 
				status: 400,
				headers: { 
					"Content-Type": "text/plain",
					"Access-Control-Allow-Origin": "*",
				}
			});
		}

		// Get endpoint type
		const endpointType = getEndpointType(url.pathname, projectId);
		
		if (!endpointType) {
			const validEndpoints = [
				`/projects/${projectId}/mcp`,
				`/projects/${projectId}/sse`,
				`/projects/${projectId}/sse/message`,
				`/projects/${projectId}/test`,
				`/projects/${projectId}/debug`
			];
			return new Response(`Invalid endpoint. Valid endpoints for project ${projectId}:\n${validEndpoints.join('\n')}`, { 
				status: 400,
				headers: { 
					"Content-Type": "text/plain",
					"Access-Control-Allow-Origin": "*",
				}
			});
		}

		try {
			// Get MCP instance for this project
			const mcpInstance = getMcpInstance(projectId);

			// Handle different endpoint types
			switch (endpointType) {
				case "sse":
				case "sse-message":
					return await mcpInstance.handleSSE(request);

				case "mcp":
					return await mcpInstance.handleMCP(request);

				case "test":
					// Simple test endpoint to verify the MCP instance is working
					try {
						const testData = {
							projectId: projectId,
							serverName: mcpInstance.server.name,
							timestamp: new Date().toISOString(),
							availableTools: Object.keys(mcpInstance.server.tools || {}),
							repoConfig: {
								orgSlug: mcpInstance.repo.orgSlug,
								projectId: mcpInstance.repo.projectId,
							}
						};
						
						return new Response(JSON.stringify(testData, null, 2), {
							status: 200,
							headers: { 
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							}
						});
					} catch (error) {
						return new Response(JSON.stringify({ 
							error: "Test endpoint error", 
							message: error.message 
						}), {
							status: 500,
							headers: { 
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							}
						});
					}

				case "debug":
					const repo = getRepoInstance(projectId);
					const responseData = {
						projectId: projectId,
						repoConfig: {
							orgSlug: repo.orgSlug,
							projectId: repo.projectId,
							debug: repo.debug
						},
						context: JSON.stringify(ctx),
						request: {
							method: request.method,
							url: request.url,
							headers: Object.fromEntries([...request.headers]),
							body: request.bodyUsed ? "Body already used" : "(Body not read)"
						}
					};
					return new Response(JSON.stringify(responseData, null, 2), { 
						status: 200,
						headers: { "Content-Type": "application/json" }
					});

				default:
					return new Response("Unknown endpoint type", { status: 500 });
			}
		} catch (error) {
			return new Response(`Error handling request for project ${projectId}: ${error.message}`, { 
				status: 500,
				headers: { "Content-Type": "text/plain" }
			});
		}
	},
};