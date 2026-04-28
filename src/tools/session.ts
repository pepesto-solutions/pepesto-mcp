import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { SkuItem, SupermarketDomain } from "../schemas.js";
import { runTool } from "./_runner.js";

export function registerSessionTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_session",
    {
      title: "Pepesto Session (build checkout session)",
      description:
        "Build a checkout session from a final list of selected SKUs. Returns a session_id " +
        "Pepesto's checkout UI (or /checkout flow) consumes. Call this after the user has " +
        "confirmed the final basket. Prefer pepesto_oneshot if you don't need fine-grained SKU " +
        "control.",
      inputSchema: {
        supermarket_domain: SupermarketDomain,
        skus: z
          .array(SkuItem)
          .min(1)
          .describe("Final basket: each session_token comes from pepesto_products."),
        user_locale: z
          .string()
          .optional()
          .describe("BCP 47 locale for the checkout UI, e.g. 'en-GB'."),
      },
    },
    async (args) => runTool(() => client.post("/session", args)),
  );
}
