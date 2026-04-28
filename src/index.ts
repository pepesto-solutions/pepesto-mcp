#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const apiKey = process.env.PEPESTO_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "pepesto-mcp: PEPESTO_API_KEY is not set.\n" +
        "See the README (\"Getting an API key\") for how to obtain one:\n" +
        "https://github.com/pepesto-solutions/pepesto-mcp#getting-an-api-key\n",
    );
    process.exit(1);
  }

  const server = createServer({ clientOptions: { apiKey } });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`pepesto-mcp: fatal error: ${err?.stack ?? err}\n`);
  process.exit(1);
});
