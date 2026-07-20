#!/usr/bin/env node
/**
 * Zentext MCP server entry point.
 *
 * Stage 1 read-only adapter. Communicates over stdio using the MCP protocol.
 * Writes no normal logs to stdout; diagnostics go to stderr.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
