import { PepestoApiError } from "../client.js";

export interface ToolResult {
  [k: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg =
      err instanceof PepestoApiError
        ? err.message
        : err instanceof Error
        ? `Error: ${err.message}`
        : `Error: ${String(err)}`;
    return {
      content: [{ type: "text", text: msg }],
      isError: true,
    };
  }
}
