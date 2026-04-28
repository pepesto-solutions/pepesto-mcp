import { describe, expect, test, vi } from "vitest";
import { PepestoApiError, PepestoClient } from "../src/client.js";

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeFetchStub(
  responder: (call: FetchCall) => { status?: number; body?: string },
): { calls: FetchCall[]; fetch: typeof fetch } {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    const call: FetchCall = { url, init };
    calls.push(call);
    const r = responder(call);
    return new Response(r.body ?? "{}", { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, fetch: fn };
}

describe("PepestoClient", () => {
  test("sends bearer auth and JSON body to the right URL", async () => {
    const { calls, fetch: f } = makeFetchStub(() => ({
      body: JSON.stringify({ ok: true }),
    }));
    const client = new PepestoClient({ apiKey: "key-123", fetchImpl: f });

    const result = await client.post<{ ok: boolean }>("/parse", { recipe_url: "https://x" });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://s.pepesto.com/api/parse");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer key-123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ recipe_url: "https://x" });
  });

  test("throws actionable error when API key missing", async () => {
    const { fetch: f } = makeFetchStub(() => ({ body: "{}" }));
    const client = new PepestoClient({ fetchImpl: f });

    await expect(client.post("/credits", {})).rejects.toThrow(/PEPESTO_API_KEY is not set/);
  });

  test("maps non-2xx to PepestoApiError with status, endpoint, body", async () => {
    const { fetch: f } = makeFetchStub(() => ({
      status: 402,
      body: '{"error":"insufficient_credits"}',
    }));
    const client = new PepestoClient({ apiKey: "k", fetchImpl: f });

    try {
      await client.post("/oneshot", {});
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PepestoApiError);
      const e = err as PepestoApiError;
      expect(e.status).toBe(402);
      expect(e.endpoint).toBe("/oneshot");
      expect(e.body).toContain("insufficient_credits");
      expect(e.message).toMatch(/402.*\/oneshot/);
    }
  });

  test("normalizes baseUrl trailing slash and accepts endpoint without leading slash", async () => {
    const { calls, fetch: f } = makeFetchStub(() => ({ body: "{}" }));
    const client = new PepestoClient({
      apiKey: "k",
      baseUrl: "https://example.test/api/",
      fetchImpl: f,
    });

    await client.post("credits", {});

    expect(calls[0].url).toBe("https://example.test/api/credits");
  });

  test("returns empty object for empty body and raw text for non-JSON", async () => {
    const { fetch: empty } = makeFetchStub(() => ({ body: "" }));
    const client1 = new PepestoClient({ apiKey: "k", fetchImpl: empty });
    expect(await client1.post("/credits", {})).toEqual({});

    const { fetch: text } = makeFetchStub(() => ({ body: "plain text" }));
    const client2 = new PepestoClient({ apiKey: "k", fetchImpl: text });
    expect(await client2.post("/credits", {})).toBe("plain text");
  });

  test("PepestoApiError truncates long bodies in message", async () => {
    const long = "x".repeat(1000);
    const err = new PepestoApiError(500, "/x", long);
    expect(err.message.length).toBeLessThan(700);
    expect(err.message).toContain("…");
    expect(err.body).toBe(long);
  });
});
