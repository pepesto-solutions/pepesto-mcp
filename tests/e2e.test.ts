import { describe, expect, test, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PepestoClient } from "../src/client.js";
import { createServer } from "../src/server.js";

interface FetchCall {
  url: string;
  init: RequestInit;
}

interface Harness {
  client: Client;
  fetchCalls: FetchCall[];
  setNextResponse: (r: { status?: number; body?: string }) => void;
}

async function makeHarness(opts: { apiKey?: string } = { apiKey: "test-key" }): Promise<Harness> {
  const fetchCalls: FetchCall[] = [];
  let next: { status?: number; body?: string } = { body: '{"ok":true}' };
  const setNextResponse = (r: { status?: number; body?: string }) => {
    next = r;
  };
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    fetchCalls.push({ url, init });
    return new Response(next.body ?? "{}", { status: next.status ?? 200 });
  }) as unknown as typeof fetch;

  const pepesto = new PepestoClient({ apiKey: opts.apiKey, fetchImpl });
  const server = createServer({ client: pepesto });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, fetchCalls, setNextResponse };
}

const ALL_TOOLS = [
  "pepesto_oneshot",
  "pepesto_parse",
  "pepesto_suggest",
  "pepesto_products",
  "pepesto_catalog",
  "pepesto_credits",
] as const;

describe("MCP server (in-memory)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness();
  });

  test("tools/list exposes all 6 Pepesto tools", async () => {
    const res = await h.client.listTools();
    const names = res.tools.map((t) => t.name).sort();
    expect(names).toEqual([...ALL_TOOLS].sort());
    for (const tool of res.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  test("pepesto_oneshot POSTs to /oneshot with bearer auth and forwarded body", async () => {
    h.setNextResponse({ body: '{"redirect_url":"https://pepesto.com/checkout/abc"}' });
    const res = await h.client.callTool({
      name: "pepesto_oneshot",
      arguments: {
        content_urls: ["https://example.com/recipe"],
        content_text: "milk, bananas",
        supermarket_domain: "coop.ch",
      },
    });

    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls).toHaveLength(1);
    const call = h.fetchCalls[0];
    expect(call.url).toBe("https://s.pepesto.com/api/oneshot");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(call.init.body as string)).toEqual({
      content_urls: ["https://example.com/recipe"],
      content_text: "milk, bananas",
      supermarket_domain: "coop.ch",
    });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("https://pepesto.com/checkout/abc");
  });

  test("pepesto_parse POSTs to /parse", async () => {
    h.setNextResponse({ body: '{"kg_token":"rec123"}' });
    const res = await h.client.callTool({
      name: "pepesto_parse",
      arguments: { recipe_url: "https://example.com/r", locale: "en-GB" },
    });
    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls[0].url.endsWith("/parse")).toBe(true);
    expect(JSON.parse(h.fetchCalls[0].init.body as string)).toEqual({
      recipe_url: "https://example.com/r",
      locale: "en-GB",
    });
  });

  test("pepesto_suggest POSTs to /suggest", async () => {
    h.setNextResponse({ body: '{"recipes":[]}' });
    const res = await h.client.callTool({
      name: "pepesto_suggest",
      arguments: { query: "vegan pasta" },
    });
    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls[0].url.endsWith("/suggest")).toBe(true);
  });

  test("pepesto_products POSTs to /products", async () => {
    h.setNextResponse({ body: '{"items":[]}' });
    const res = await h.client.callTool({
      name: "pepesto_products",
      arguments: {
        recipe_kg_tokens: ["rec123"],
        supermarket_domain: "coop.ch",
      },
    });
    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls[0].url.endsWith("/products")).toBe(true);
  });

  test("pepesto_catalog POSTs to /catalog", async () => {
    h.setNextResponse({ body: '{"products":[]}' });
    const res = await h.client.callTool({
      name: "pepesto_catalog",
      arguments: { supermarket_domain: "coop.ch" },
    });
    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls[0].url.endsWith("/catalog")).toBe(true);
  });

  test("pepesto_credits POSTs to /credits with empty body", async () => {
    h.setNextResponse({ body: '{"credits_remaining":1234}' });
    const res = await h.client.callTool({ name: "pepesto_credits", arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(h.fetchCalls[0].url.endsWith("/credits")).toBe(true);
    expect(JSON.parse(h.fetchCalls[0].init.body as string)).toEqual({});
  });

  test("returns isError:true when the upstream returns a 4xx", async () => {
    h.setNextResponse({ status: 401, body: '{"error":"unauthorized"}' });
    const res = await h.client.callTool({
      name: "pepesto_credits",
      arguments: {},
    });
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/401/);
    expect(text).toContain("unauthorized");
  });

  test("returns isError:true when an authed tool is called without API key configured", async () => {
    const noKey = await makeHarness({ apiKey: undefined });
    noKey.setNextResponse({ status: 200, body: '{"x":1}' });
    const res = await noKey.client.callTool({
      name: "pepesto_credits",
      arguments: {},
    });
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/PEPESTO_API_KEY/);
  });

  test("rejects bad input via Zod (missing required field)", async () => {
    const res = await h.client.callTool({
      name: "pepesto_products",
      arguments: { supermarket_domain: "coop.ch" /* recipe_kg_tokens missing */ },
    });
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/recipe_kg_tokens/);
    expect(h.fetchCalls).toHaveLength(0);
  });
});
