#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const apiKey = process.env.PEPESTO_API_KEY;
  if (!apiKey) {
    // Start anyway so MCP clients can list tools without credentials configured.
    // Tool *calls* still fail loudly via the client — see src/client.ts.
    process.stderr.write(
      "pepesto-mcp: PEPESTO_API_KEY is not set — tool calls will fail until it is.\n" +
        "See https://github.com/pepesto-solutions/pepesto-mcp#getting-an-api-key\n",
    );
  }

  const server = createServer({ clientOptions: { apiKey } });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`pepesto-mcp: fatal error: ${err?.stack ?? err}\n`);
  process.exit(1);
});
