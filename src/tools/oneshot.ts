import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { SupermarketDomain } from "../schemas.js";
import { runTool } from "./_runner.js";

export function registerOneshotTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_oneshot",
    {
      title: "Pepesto Oneshot (recipe → cart)",
      description:
        "One-shot: turn recipe URLs, free-form text, and/or an image into a ready-to-checkout " +
        "cart for a chosen European supermarket. Returns a redirect_url that opens the Pepesto " +
        "checkout UI for the user to verify and pay. Internally runs parse + products + session " +
        "with Pepesto's heuristics. Use this when you want the simplest end-to-end flow; use " +
        "pepesto_parse + pepesto_products + pepesto_session for finer control.",
      inputSchema: {
        content_urls: z
          .array(z.string().url())
          .optional()
          .describe("Recipe URLs to parse and shop."),
        content_text: z
          .string()
          .optional()
          .describe("Free-form shopping list or extra items to include."),
        content_image: z
          .string()
          .optional()
          .describe("Base64-encoded recipe image."),
        supermarket_domain: SupermarketDomain.optional(),
      },
    },
    async (args) =>
      runTool(() => client.post("/oneshot", args)),
  );
}
