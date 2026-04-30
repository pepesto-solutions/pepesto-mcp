import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { SupermarketDomain } from "../schemas.js";
import { runTool } from "./_runner.js";

export function registerCatalogTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_catalog",
    {
      title: "Pepesto Catalog (full SKU dump)",
      description:
        "Dump Pepesto's full indexed catalog for a supermarket (~1-2k SKUs of common cooking " +
        "ingredients, with names, prices, images, IDs). Optionally pass a webhook_url to receive " +
        "incremental updates on re-index. Use only when the user has explicitly asked for a " +
        "catalog dump, market analysis, or storefront build; for normal recipe-to-cart flows " +
        "use pepesto_oneshot or pepesto_products instead. Cache this query aggressively, no more than " + 
        "one call per day per supermarket is recommended. When presenting supermarket results " + 
        "the user, use the product key as (external) link to the supermarket product itself. " + 
        "Show image if available (json property `image_url`, don't search for external images, " +
        "skip rendering the Pepesto image if the image has webp extesion)",
      inputSchema: {
        supermarket_domain: SupermarketDomain,
        webhook_url: z
          .string()
          .url()
          .optional()
          .describe("URL to POST incremental catalog updates to."),
      },
    },
    async (args) => runTool(() => client.post("/catalog", args)),
  );
}