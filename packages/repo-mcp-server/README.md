# dev

Run in browser.

npx @modelcontextprotocol/inspector@latest

# repo.md mcp server

https://playground.ai.cloudflare.com/

https://mcp.repo.md/projects/6817b5005374612ed8b91ffa/sse

## prod deploy

mcp.repo.md
https://mcp.repo.md/
https://mcp.repo.md/sse

Test deployment:
https://repo-mcp-server2.fragile.workers.dev/

### Project-specific URLs

New route format with organization and project ID:

```
https://repo-mcp-server2.fragile.workers.dev/org/iplanwebsites/projects/id/680e97604a0559a192640d2c/sse
https://repo-mcp-server2.fragile.workers.dev/org/iplanwebsites/projects/id/680e97604a0559a192640d2c/sse/message
```

Legacy routes:

```
https://repo-mcp-server2.fragile.workers.dev/sse
https://repo-mcp-server2.fragile.workers.dev/sse/message
https://repo-mcp-server2.fragile.workers.dev/mcp
```

https://dash.cloudflare.com/59dc7081f9d54683e8c654d829bd119f/workers/services/view/repo-mcp-server/production/metrics

Updates on push

# Forked Docs: Building a Remote MCP Server on Cloudflare (Without Auth)

This example allows you to deploy a remote MCP server that doesn't require authentication on Cloudflare Workers.

## Get started:

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

This will deploy your MCP server to a URL like: `remote-mcp-server-authless.<your-account>.workers.dev/sse`

Alternatively, you can use the command line below to get the remote MCP Server created on your local machine:

```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```

## Customizing your MCP Server

To add your own [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/) to the MCP server, define each tool inside the `init()` method of `src/index.ts` using `this.server.tool(...)`.

## Connect to Cloudflare AI Playground

You can connect to your MCP server from the Cloudflare AI Playground, which is a remote MCP client:

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`remote-mcp-server-authless.<your-account>.workers.dev/sse`)
3. You can now use your MCP tools directly from the playground!

## Connect Claude Desktop to your MCP server

You can also connect to your remote MCP server from local MCP clients, by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote).

To connect to your MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse" // or remote-mcp-server-authless.your-account.workers.dev/sse
      ]
    }
  }
}
```

Restart Claude and you should see the tools become available.
