// Read-only stdio MCP server. Run: npm run --silent mcp. Never write to stdout here.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "@/mcp/server";

await createServer().connect(new StdioServerTransport());
