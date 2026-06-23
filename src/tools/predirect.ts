import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PepestoApiError, type PepestoClient } from "../client.js";
import type { ToolResult } from "./_runner.js";

interface PredirectResponse {
  redirect_url?: string;
}

/** Count list entries across newline- or comma-separated input. */
function countItems(shoppingList: string): number {
  return shoppingList
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/** Build the ready-to-show Markdown call-to-action for a redirect link. */
function renderLink(url: string, itemCount: number): string {
  const items =
    itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"} ready · ` : "";
  return (
    `**[🛒 Open your shopping list in Pepesto →](${url})**\n\n` +
    `Free to open · ${items}you only pay at checkout in the app.`
  );
}

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
        "This is an end-user / agent-facing handoff (e.g. a person chatting in Claude Desktop who " +
        "wants to finish shopping on their phone), not a developer-integration endpoint. " +
        "Choose pepesto_predirect when the cost should fall on the end user and a deferred deep " +
        "link is acceptable. Choose pepesto_oneshot instead when the client wants the basket " +
        "matched up front (with prices) and is willing to pay for the matching. " +
        "PRESENTATION (important): the tool's text output is ready-to-show Markdown — a single " +
        "tappable, labeled link plus a one-line caption. Surface it to the user exactly as " +
        "returned; do NOT also paste the long raw URL as plain text. You may add one short " +
        "sentence telling them to open it on their phone (on a computer, opening it shows a QR " +
        "code to scan).",
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
    async (args): Promise<ToolResult> => {
      try {
        const result = await client.post<PredirectResponse>("/predirect", args, {
          auth: false,
        });
        const url = result?.redirect_url;
        if (typeof url !== "string" || url.length === 0) {
          // Unexpected shape — hand back the raw payload so nothing is lost.
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return {
          content: [{ type: "text", text: renderLink(url, countItems(args.shopping_list)) }],
        };
      } catch (err) {
        const msg =
          err instanceof PepestoApiError
            ? err.message
            : err instanceof Error
            ? `Error: ${err.message}`
            : `Error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], isError: true };
      }
    },
  );
}
