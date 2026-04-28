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
        query: z.string().min(1).describe("Free-text query, e.g. 'vegan pasta dinner for two'."),
        ingredients_include: z
          .array(z.string())
          .optional()
          .describe("Ingredients that must be present."),
        ingredients_exclude: z
          .array(z.string())
          .optional()
          .describe("Ingredients to avoid."),
        cuisine: z.string().optional().describe("Cuisine, e.g. 'italian', 'thai'."),
        dietary_tags: z
          .array(z.string())
          .optional()
          .describe("Dietary tags, e.g. ['vegan','gluten-free']."),
        max_minutes: z.number().int().positive().optional().describe("Max prep+cook minutes."),
        num_servings: z.number().int().positive().optional().describe("Target number of servings."),
        locale: z.string().optional().describe("BCP 47 locale, e.g. 'en-GB'."),
      },
    },
    async (args) => runTool(() => client.post("/suggest", args)),
  );
}
