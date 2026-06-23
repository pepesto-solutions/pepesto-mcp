import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { runTool } from "./_runner.js";

export function registerPredirectTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_predirect",
    {
      title: "Pepesto Predirect (free deferred shopping link)",
      description:
        "Turn a free-form shopping list into a deferred deep link to the Pepesto mobile app, " +
        "returned as a redirect_url. This is a PUBLIC endpoint: it is FREE to the API client, " +
        "needs no API key, and returns instantly. Parsing and product matching happen lazily, " +
        "only after the user opens the link — and the USER (not the API client) is charged when " +
        "they proceed to checkout in the app. If the app isn't installed, the user is sent to the " +
        "app store first and the shopping list is preserved until the app opens. " +
        "Choose pepesto_predirect when the cost should fall on the end user and a deferred deep " +
        "link is acceptable. Choose pepesto_oneshot instead when the client wants the basket " +
        "matched up front (with prices) and is willing to pay for the matching.",
      inputSchema: {
        shopping_list: z
          .string()
          .min(1)
          .describe(
            "Free-form shopping list. May contain multiple newline-separated lines, " +
              "e.g. '2 avocados\\n1 loaf of bread\\n500 g tomatoes'.",
          ),
        locale: z
          .string()
          .optional()
          .describe("User's locale, e.g. 'de-DE'. Optional."),
      },
    },
    async (args) => runTool(() => client.post("/predirect", args, { auth: false })),
  );
}
