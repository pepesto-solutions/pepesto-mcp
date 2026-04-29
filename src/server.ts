import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PepestoClient, type PepestoClientOptions } from "./client.js";
import { registerOneshotTool } from "./tools/oneshot.js";
import { registerParseTool } from "./tools/parse.js";
import { registerSuggestTool } from "./tools/suggest.js";
import { registerProductsTool } from "./tools/products.js";
import { registerCatalogTool } from "./tools/catalog.js";
import { registerCreditsTool } from "./tools/credits.js";

export interface CreateServerOptions {
  client?: PepestoClient;
  clientOptions?: PepestoClientOptions;
}

export function createServer(opts: CreateServerOptions = {}): McpServer {
  const client = opts.client ?? new PepestoClient(opts.clientOptions);

  const server = new McpServer(
    { name: "pepesto-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerOneshotTool(server, client);
  registerParseTool(server, client);
  registerSuggestTool(server, client);
  registerProductsTool(server, client);
  registerCatalogTool(server, client);
  registerCreditsTool(server, client);

  return server;
}
