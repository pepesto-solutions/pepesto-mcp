import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import { PepestoApiError, PepestoClient } from "../src/client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "fixtures");

interface Fixture {
  name: string;
  request: { method: "POST"; endpoint: string; body_raw: string };
  response: { status: number; body: string };
}

const load = (name: string): Fixture =>
  JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8")) as Fixture;

// Drive a fixture through PepestoClient with a fetch stub that returns the
// recorded response, and return whatever the client parsed out of it.
async function callFixture(fx: Fixture): Promise<unknown> {
  const fetchImpl = vi.fn(
    async () => new Response(fx.response.body, { status: fx.response.status }),
  ) as unknown as typeof fetch;
  const client = new PepestoClient({ apiKey: "test-key", fetchImpl });
  return client.post(fx.request.endpoint, JSON.parse(fx.request.body_raw));
}

// ─── /credits ─────────────────────────────────────────────────────────────

/**
 * Request:  POST /credits with `{}` and Bearer auth.
 * Response: 200 OK with `{ "euro_cents": <int> }`.
 * Action:   PepestoClient parses the JSON body and returns it.
 * Reaction: Caller gets an object with a numeric `euro_cents` field.
 */
describe("/credits — happy path returns the remaining account balance", () => {
  const fx = load("credits_ok");

  test("the parsed body has a numeric `euro_cents` field", async () => {
    const obj = (await callFixture(fx)) as { euro_cents: unknown };
    expect(typeof obj.euro_cents).toBe("number");
  });
});

// ─── /parse ───────────────────────────────────────────────────────────────

/**
 * Request:  POST /parse with `{ recipe_url, locale }`.
 * Response: 200 OK with `{ "recipe": { kg_token, title, ingredients[], ... } }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets the recipe nested under `.recipe`, with kg_token + title + ingredients.
 */
describe("/parse — happy path: recipe URL → structured recipe with kg_token", () => {
  const fx = load("parse_url_ok");

  test("the parsed body has `recipe.kg_token`, `recipe.title`, `recipe.ingredients[]`, `recipe.steps[]`", async () => {
    const obj = (await callFixture(fx)) as {
      recipe?: { kg_token?: unknown; title?: unknown; ingredients?: unknown };
    };
    expect(typeof obj.recipe?.kg_token).toBe("string");
    expect(typeof obj.recipe?.title).toBe("string");
    expect(Array.isArray(obj.recipe?.ingredients)).toBe(true);
    expect(Array.isArray(obj.recipe?.steps)).toBe(true);
  });
});

/**
 * Request:  POST /parse with `{}` (no recipe input).
 * Response: 200 OK with a Go stack-trace string ("Could not extract any recipe").
 * Action:   PepestoClient sees 2xx + non-JSON body, returns the raw text.
 * Reaction: Caller receives the trace string — Pepesto signals the error via body, not status.
 */
describe("/parse — empty input is permissive: 200 with an error-text body, not 4xx", () => {
  const fx = load("parse_no_input");

  test("the response is propagated as a string (200 + non-JSON)", async () => {
    const out = await callFixture(fx);
    expect(typeof out).toBe("string");
    expect(out as string).toContain("Could not extract any recipe");
  });
});

// ─── /suggest ─────────────────────────────────────────────────────────────

/**
 * Request:  POST /suggest with `{ query }`.
 * Response: 200 OK with `{ "recipes": [...], "short_response": "..." }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets a non-empty `recipes[]`, each item carrying a kg_token.
 */
describe("/suggest — happy path: free-text query → recipes with kg_tokens", () => {
  const fx = load("suggest_ok");

  test("the parsed body has a non-empty `recipes[]` with a kg_token on each item", async () => {
    const obj = (await callFixture(fx)) as { recipes?: Array<{ kg_token?: unknown }> };
    expect(Array.isArray(obj.recipes)).toBe(true);
    expect(obj.recipes!.length).toBeGreaterThan(0);
    expect(typeof obj.recipes![0].kg_token).toBe("string");
  });
});

/**
 * Request:  POST /suggest with `{}` (no query).
 * Response: 200 OK with `{}`.
 * Action:   PepestoClient parses an empty object.
 * Reaction: Caller gets `{}` — Pepesto silently returns no results, no error.
 */
describe("/suggest — missing query is permissive: 200 with empty `{}`", () => {
  const fx = load("suggest_missing_query");

  test("the parsed body is an empty object", async () => {
    expect(await callFixture(fx)).toEqual({});
  });
});

// ─── /oneshot ─────────────────────────────────────────────────────────────

/**
 * Request:  POST /oneshot with `{ content_urls, supermarket_domain, content_text }`.
 * Response: 200 OK with `{ "redirect_url": "https://..." }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets a `redirect_url` (an https URL) that opens the Pepesto checkout UI.
 */
describe("/oneshot — happy path: recipe + supermarket → redirect_url", () => {
  const fx = load("oneshot_ok");

  test("the parsed body has a `redirect_url` https string", async () => {
    const obj = (await callFixture(fx)) as { redirect_url?: unknown };
    expect(typeof obj.redirect_url).toBe("string");
    expect((obj.redirect_url as string).startsWith("https://")).toBe(true);
  });
});

/**
 * Request:  POST /oneshot with only `{ supermarket_domain }` and no content inputs.
 * Response: 200 OK with `{ "redirect_url": "https://app.pepesto.com/composed?force=1&req=" }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets an empty-cart redirect — Pepesto is permissive on missing inputs.
 */
describe("/oneshot — no content inputs is permissive: 200 with an empty-cart redirect_url", () => {
  const fx = load("oneshot_missing_inputs");

  test("the body still has a redirect_url string", async () => {
    const obj = (await callFixture(fx)) as { redirect_url?: unknown };
    expect(typeof obj.redirect_url).toBe("string");
  });
});

// ─── /products ────────────────────────────────────────────────────────────

/**
 * Request:  POST /products with `{ recipe_kg_tokens, supermarket_domain }`.
 * Response: 200 OK with `{ currency, items: [{ products: [{ session_token, ... }] }], missing_items }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets `items[]` with at least one matched product per ingredient,
 *           each product carrying a `session_token` ready to feed into /session.
 */
describe("/products — happy path: kg_token + market → SKUs with session_tokens", () => {
  const fx = load("products_ok");

  test("the parsed body has `currency`, `items[]`, and at least one product with a session_token", async () => {
    const obj = (await callFixture(fx)) as {
      currency?: unknown;
      items?: Array<{ products?: Array<{ session_token?: unknown }> }>;
    };
    expect(typeof obj.currency).toBe("string");
    expect(Array.isArray(obj.items)).toBe(true);
    const firstWithMatch = obj.items!.find((it) => (it.products?.length ?? 0) > 0);
    expect(firstWithMatch).toBeDefined();
    expect(typeof firstWithMatch!.products![0].session_token).toBe("string");
  });
});

/**
 * Request:  POST /products with `{ recipe_kg_tokens: ["bogus"] }` — no supermarket_domain.
 * Response: 400 with a Go stack-trace text body.
 * Action:   PepestoClient throws PepestoApiError.
 * Reaction: Caller catches the error.
 */
describe("/products — missing supermarket_domain raises 400", () => {
  const fx = load("products_missing_market");

  test("the 400 propagates as PepestoApiError", async () => {
    let caught: unknown;
    try {
      await callFixture(fx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PepestoApiError);
    const e = caught as PepestoApiError;
    expect(e.status).toBe(fx.response.status);
    expect(e.endpoint).toBe(fx.request.endpoint);
    expect(e.body).toBe(fx.response.body);
  });
});

/**
 * Request:  POST /products with a kg_token that is not valid base64.
 * Response: 400 — "illegal base64 data at input byte N".
 * Action:   PepestoClient throws PepestoApiError.
 * Reaction: Caller catches the error.
 */
describe("/products — kg_token that's not valid base64 raises 400", () => {
  const fx = load("products_invalid_kg_token");

  test("the 400 propagates as PepestoApiError", async () => {
    let caught: unknown;
    try {
      await callFixture(fx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PepestoApiError);
    const e = caught as PepestoApiError;
    expect(e.status).toBe(fx.response.status);
    expect(e.endpoint).toBe(fx.request.endpoint);
    expect(e.body).toBe(fx.response.body);
  });
});

// ─── /session ─────────────────────────────────────────────────────────────

/**
 * Request:  POST /session with `{ supermarket_domain, skus: [{ session_token, num_units_to_buy }] }`.
 * Response: 200 OK with `{ session_id, payment_redirect_url }`.
 * Action:   PepestoClient parses the JSON body.
 * Reaction: Caller gets a session_id that can be passed on to /checkout.
 */
describe("/session — happy path: SKU list → session_id", () => {
  const fx = load("session_ok");

  test("the parsed body has `session_id` and `payment_redirect_url` strings", async () => {
    const obj = (await callFixture(fx)) as {
      session_id?: unknown;
      payment_redirect_url?: unknown;
    };
    expect(typeof obj.session_id).toBe("string");
    expect(typeof obj.payment_redirect_url).toBe("string");
  });
});

/**
 * Request:  POST /session with `{}` — no fields.
 * Response: 400 with a Go stack-trace text body.
 * Action:   PepestoClient throws PepestoApiError.
 * Reaction: Caller catches the error.
 */
describe("/session — empty body raises 400", () => {
  const fx = load("session_missing_required");

  test("the 400 propagates as PepestoApiError", async () => {
    let caught: unknown;
    try {
      await callFixture(fx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PepestoApiError);
    const e = caught as PepestoApiError;
    expect(e.status).toBe(fx.response.status);
    expect(e.endpoint).toBe(fx.request.endpoint);
    expect(e.body).toBe(fx.response.body);
  });
});

/**
 * Request:  POST /session with `{ supermarket_domain, skus: [] }` — no SKUs.
 * Response: 400 with a Go stack-trace text body.
 * Action:   PepestoClient throws PepestoApiError.
 * Reaction: Caller catches the error.
 */
describe("/session — empty SKU list raises 400", () => {
  const fx = load("session_empty_skus");

  test("the 400 propagates as PepestoApiError", async () => {
    let caught: unknown;
    try {
      await callFixture(fx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PepestoApiError);
    const e = caught as PepestoApiError;
    expect(e.status).toBe(fx.response.status);
    expect(e.endpoint).toBe(fx.request.endpoint);
    expect(e.body).toBe(fx.response.body);
  });
});

/**
 * Request:  POST /session with a bogus session_token.
 * Response: 400 with a Go stack-trace text body.
 * Action:   PepestoClient throws PepestoApiError.
 * Reaction: Caller catches the error.
 */
describe("/session — bogus session_token raises 400", () => {
  const fx = load("session_invalid_token");

  test("the 400 propagates as PepestoApiError", async () => {
    let caught: unknown;
    try {
      await callFixture(fx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PepestoApiError);
    const e = caught as PepestoApiError;
    expect(e.status).toBe(fx.response.status);
    expect(e.endpoint).toBe(fx.request.endpoint);
    expect(e.body).toBe(fx.response.body);
  });
});

// ─── /catalog ─────────────────────────────────────────────────────────────

/**
 * Request:  POST /catalog with `{}`.
 * Response: 200 with a Go stack-trace text body ("Unsupported supermarket").
 * Action:   PepestoClient sees 2xx + non-JSON body → returns the raw string.
 * Reaction: Caller gets the trace string — Pepesto signals the error via body, not status.
 */
describe("/catalog — empty body returns 200 with an error-text body, not 4xx", () => {
  const fx = load("catalog_missing_required");

  test("the trace string is propagated", async () => {
    const out = await callFixture(fx);
    expect(typeof out).toBe("string");
    expect(out as string).toContain("Unsupported supermarket");
  });
});

/**
 * Request:  POST /catalog with `{ supermarket_domain: "not-a-real-supermarket.invalid" }`.
 * Response: 200 with the same "Unsupported supermarket" trace.
 * Action:   PepestoClient returns the raw string.
 * Reaction: Caller gets the trace string.
 */
describe("/catalog — unknown supermarket also returns 200 with the same error text", () => {
  const fx = load("catalog_unknown_market");

  test("the trace string is propagated", async () => {
    const out = await callFixture(fx);
    expect(typeof out).toBe("string");
    expect(out as string).toContain("Unsupported supermarket");
  });
});
