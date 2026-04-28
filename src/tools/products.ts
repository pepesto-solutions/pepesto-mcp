import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { KgToken, SupermarketDomain } from "../schemas.js";
import { runTool } from "./_runner.js";

export function registerProductsTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_products",
    {
      title: "Pepesto Products (KgToken → real SKUs)",
      description:
        "Map one or more recipe KgTokens (and an optional manual shopping list) to concrete " +
        "supermarket products with prices, images, and per-product session_tokens. Items are " +
        "merged across recipes to reduce waste; multiple matches per ingredient let you (or the " +
        "user) pick. Pass the chosen session_tokens to pepesto_session to build a checkout " +
        "session.",
      inputSchema: {
        recipe_kg_tokens: z
          .array(KgToken)
          .min(1)
          .describe("KgTokens from pepesto_parse or pepesto_suggest."),
        supermarket_domain: SupermarketDomain,
        manual_shopping_list: z
          .string()
          .optional()
          .describe("Free-text extra items to add (e.g. 'milk, bananas, kitchen towel')."),
      },
    },
    async (args) => runTool(() => client.post("/products", args)),
  );
}
