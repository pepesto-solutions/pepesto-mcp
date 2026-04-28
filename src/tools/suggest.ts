import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { runTool } from "./_runner.js";

export function registerSuggestTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_suggest",
    {
      title: "Pepesto Suggest (search 1M+ recipes)",
      description:
        "Search Pepesto's recipe graph (1M+ recipes) by free-text query and optional filters " +
        "(cuisine, dietary tags, ingredients to include/avoid, time, servings). Each result " +
        "includes a KgToken you can pass to pepesto_products. Returned images are licensed for " +
        "display in your app or website without attribution; the license is good for 24 hours " +
        "after the call.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Free-text query that may include cuisine, dietary tags, ingredients to include " +
              "or avoid, time constraints, and servings, e.g. 'vegan keto dinner low on carb " +
              "for two'.",
          ),
      },
    },
    async (args) => runTool(() => client.post("/suggest", args)),
  );
}