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
        "supermarket products with prices, images, or currency. Items are " +
        "merged across recipes to reduce waste; multiple matches per ingredient let you (or the " +
        "user) pick. Show product title, image if available (json property `image_url`, don't search for external images), " +
        "product_id when available linking to an (external) supermarket page (open in a new tab), " + 
        "price, ProductClassification (is_bio, is_frozen, is_substitution) tags. PricePromotion " + 
        "shows if the item is currently on promotion and what's current `promo_percentage`",
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
