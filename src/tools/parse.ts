import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PepestoClient } from "../client.js";
import { runTool } from "./_runner.js";

export function registerParseTool(server: McpServer, client: PepestoClient): void {
  server.registerTool(
    "pepesto_parse",
    {
      title: "Pepesto Parse (recipe → structured ingredients)",
      description:
        "Parse a recipe from a URL, free-form text, or image into a structured object: title, " +
        "ingredients, nutrition, instructions, and a KgToken you can pass to pepesto_products to " +
        "build a real cart.",
      inputSchema: {
        recipe_url: z
          .string()
          .url()
          .optional()
          .describe("Publicly crawlable recipe URL."),
        recipe_text: z
          .string()
          .optional()
          .describe("Free-form recipe text."),
        recipe_image: z
          .string()
          .optional()
          .describe("Base64-encoded recipe image."),
        locale: z
          .string()
          .optional()
          .describe("BCP 47 locale, e.g. 'en-GB', 'de-CH'."),
        generate_image: z
          .boolean()
          .optional()
          .describe("Whether to generate a shareable image of the recipe."),
      },
    },
    async (args) => runTool(() => client.post("/parse", args)),
  );
}
