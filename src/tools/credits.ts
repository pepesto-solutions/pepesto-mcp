import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PepestoClient } from "../client.js";
import { runTool } from "./_runner.js";

export function registerCreditsTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_credits",
    {
      title: "Pepesto Credits (check balance)",
      description:
        "Return the remaining API credits on the configured Pepesto API key.",
      inputSchema: {},
    },
    async () => runTool(() => client.post("/credits", {})),
  );
}
