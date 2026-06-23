# Pepesto MCP Server

<!-- mcp-name: io.github.pepesto-solutions/pepesto-mcp -->

MCP server for the [Pepesto API](https://www.pepesto.com/ai-grocery-shopping-agent/) — give your agent the ability to turn any recipe (a URL, plain text, or a photo) into a matched basket of real supermarket products with live prices, across 26 European supermarkets. The MCP covers the **recipe → matched cart** half of the workflow (parse / search / map ingredients to SKUs / check catalogs); placing the actual order is a separate step — see [Where checkout actually happens](#where-checkout-actually-happens).

## Quick install

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pepesto": {
      "command": "npx",
      "args": ["-y", "@pepesto/pepesto-mcp"],
      "env": { "PEPESTO_API_KEY": "pep_sk_…" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add pepesto -e PEPESTO_API_KEY=pep_sk_… -- npx -y @pepesto/pepesto-mcp
```

## Getting an API key

> Most tools need a key, but `pepesto_predirect` is **public and free** — it works with no key at all (the end user pays when they check out in the app).

1. Start with a pay-as-you-go credit pack — see <https://www.pepesto.com/pricing/>.
2. Mint an API key by calling `/link` with the email you used at checkout. The key is returned **only once** — store it immediately.

   ```bash
   curl -X POST https://s.pepesto.com/api/link \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com"}'
   ```

3. Set the key in your environment:

   ```bash
   export PEPESTO_API_KEY=pep_sk_…
   ```

## Tools

| Tool | Endpoint | Description |
| --- | --- | --- |
| `pepesto_oneshot`   | `POST /oneshot`   | One-shot recipe → matched cart, including a `redirect_url` for checkout. |
| `pepesto_predirect` | `POST /predirect` | **Free, no API key.** Shopping list → deferred deep link (`redirect_url`); the **end user** pays when they check out in the Pepesto app. |
| `pepesto_parse`     | `POST /parse`     | Parse a URL/text/image recipe into structured ingredients + `KgToken`. |
| `pepesto_suggest`   | `POST /suggest`   | Search Pepesto's 1M+ recipe graph. |
| `pepesto_products`  | `POST /products`  | Map `KgToken`s + supermarket to concrete products with prices. |
| `pepesto_catalog`   | `POST /catalog`   | Full SKU dump for a supermarket. Only when explicitly requested; cache results. |
| `pepesto_credits`   | `POST /credits`   | Check remaining credits. Free. |

The MCP stops at "matched cart with prices" — see [Where checkout actually happens](#where-checkout-actually-happens) for how users finish the order. `/session`, `/checkout`, and `/link` are intentionally not wrapped; see [Roadmap](#roadmap) for what's planned.

## Example conversations

### Quick: recipe URL → matched cart

The fastest path. One tool call returns a matched cart and a checkout link.

> **User:** Use the BBC Good Food pizza margherita recipe to build a Tesco cart, and also add sparkling water and olive oil.
>
> **Assistant:** *[Uses `pepesto_oneshot` with `content_urls`, `content_text`, `supermarket_domain: "tesco.com"`]*
>
> **Assistant:** Cart matched at Tesco. Checkout link: `<redirect_url>`.

### Free, deferred handoff → end user pays (`pepesto_predirect`)

When the API client doesn't want to pay for matching and a deferred deep link is acceptable. `pepesto_predirect` is **free** and needs **no API key**: it returns instantly with a link, and parsing + product matching happen lazily once the user opens it. The **user** is charged when they proceed to checkout in the Pepesto app (if the app isn't installed, they're sent to the app store first and the list is preserved).

> **Who this is for:** `pepesto_predirect` is an **end-user / agent-facing** tool, not a developer-integration endpoint. It's the right fit when a person is chatting with an assistant (Claude Desktop, ChatGPT, etc.) and wants to hand their shopping list off to their own phone — the agent returns a link, the user finishes (and pays) in the app. If you're a developer building a product *on top of* Pepesto, you'll usually want `pepesto_oneshot` (matched cart up front, you pay) instead. Got a developer use case for `predirect` anyway? [Tell us](https://www.pepesto.com/contact) — we'd love to hear it.

Use `pepesto_predirect` when the cost should fall on the end user; use `pepesto_oneshot` when the client wants the basket matched up front (with prices) and is willing to pay for it.

> **User:** Here's my weekly shopping list — just give me a link I can open on my phone to finish in the Pepesto app.
>
> **Assistant:** *[Uses `pepesto_predirect` with `shopping_list: "2 avocados\n1 loaf of bread\n500 g tomatoes\n..."`]*
>
> **Assistant:** Done — **[🛒 Open your shopping list in Pepesto →](…)**
> Free to open · 3 items ready · you only pay at checkout in the app. Open it on your phone (on a computer it'll show a QR code to scan).

The tool returns this as ready-to-show Markdown — one tappable, labeled link plus a short caption — so the long `redirect_url` is never dumped as raw text.

### Browse the recipe graph → pick → matched cart

For "find me something to cook" prompts, where the agent searches Pepesto's recipe graph first and returns matched products with prices.

> **User:** Find me a vegan pasta recipe for two.
>
> **Assistant:** *[Uses `pepesto_suggest` with `query: "vegan pasta dinner for two"`]*
>
> **Assistant:** Three options: *Creamy Cashew Penne*, *Lemon Garlic Spaghetti*, *Roasted Veg Rigatoni*. Which would you like?
>
> **User:** Go with the first one. Shop it at Coop (coop.ch).
>
> **Assistant:** *[Uses `pepesto_products` with the chosen recipe's `kg_token` and `supermarket_domain: "coop.ch"`]*
>
> **Assistant:** Matched 8 ingredients at Coop — cashews CHF 4.20, penne CHF 1.95, ... — total CHF 18.40.

### Parse a specific recipe → matched cart

When the user already has a recipe URL or text in mind. The MCP returns the matched product list — what to do with it is up to you.

> **User:** Parse this and break out the ingredients: https://www.bbcgoodfood.com/recipes/pizza-margherita-4-easy-steps
>
> **Assistant:** *[Uses `pepesto_parse` with `recipe_url`]*
>
> **Assistant:** *Pizza Margherita in 4 easy steps* — 8 ingredients: strong bread flour, fast-action yeast, ...
>
> **User:** Now match those to Sainsbury's products.
>
> **Assistant:** *[Uses `pepesto_products` with the returned `kg_token` and `supermarket_domain: "sainsburys.co.uk"`]*
>
> **Assistant:** Matched 8 ingredients at Sainsbury's — total £6.40.

### Weekly meal plan → one merged matched cart

Multiple `kg_token`s through `pepesto_products` in a single call — Pepesto merges duplicated ingredients across recipes.

> **User:** Plan 5 keto dinners for the week and match them at Delhaize.
>
> **Assistant:** *[Uses `pepesto_suggest` with `query: "keto dinner low carb high protein", num_to_fetch: 5`]*
>
> **Assistant:** Five dinners: *Steak & Kale*, *Salmon Avocado Bowl*, *Zucchini Lasagna*, *Cauliflower Risotto*, *Chicken Caesar*.
>
> **User:** Build one shopping list that covers the whole week.
>
> **Assistant:** *[Uses `pepesto_products` with all five `kg_tokens` and `supermarket_domain: "delhaize.be"`]*
>
> **Assistant:** Combined match: 24 unique ingredients (some shared across recipes), estimated total €68.40 at Delhaize.

### Compare prices across two supermarkets

Run the same recipe through `pepesto_products` for each market and compare totals.

> **User:** Parse this Sunday lunch recipe.
>
> **Assistant:** *[Uses `pepesto_parse`]*
>
> **Assistant:** Got it: *Italian Sunday Lunch*, 12 ingredients.
>
> **User:** Show me the cart at both Esselunga and Conad so I can compare.
>
> **Assistant:** *[Uses `pepesto_products` twice — `supermarket_domain: "spesaonline.esselunga.it"`, then `supermarket_domain: "spesaonline.conad.it"`]*
>
> **Assistant:** Esselunga: €34.20. Conad: €31.50. Conad is €2.70 cheaper, mostly on pasta and tomatoes.

### Catalog dump for market analysis

Only on explicit request, and cache aggressively — see [Pricing & best practices](#pricing--best-practices) below.

> **User:** I'm building a price-comparison dashboard. Pull the full Plus NL catalog.
>
> **Assistant:** Heads up — `pepesto_catalog` is the most expensive call here. I'll only run it once; you should cache the result for at least a day. Confirm?
>
> **User:** Yes.
>
> **Assistant:** *[Uses `pepesto_catalog` with `supermarket_domain: "plus.nl"`]*
>
> **Assistant:** Catalog dumped: 1,847 SKUs across 23 categories.

## Supported supermarkets

| # | Country | Supermarket | Domain / ID |
| --- | --- | --- | --- |
| 2 | 🇬🇧 GB | Sainsbury's | sainsburys.co.uk |
| 3 | 🇬🇧 GB | ASDA | asda.com |
| 4 | 🇬🇧 GB | Morrisons | groceries.morrisons.com |
| 5 | 🇬🇧 GB | Waitrose | waitrose.com |
| 1 | 🇬🇧 GB | Tesco | tesco.com |
| 6 | 🇳🇱 NL | Albert Heijn | ah.nl |
| 7 | 🇳🇱 NL | Jumbo | jumbo.com |
| 8 | 🇳🇱 NL | Plus NL | plus.nl |
| 9 | 🇩🇪 DE | Rewe | shop.rewe.de |
| 10 | 🇨🇭 CH | Coop CH | coop.ch |
| 11 | 🇨🇭 CH | Migros | migros.ch |
| 12 | 🇨🇭 CH | Farmy | farmy.ch |
| 13 | 🇨🇭 CH | Aldi CH | aldi-now.ch |
| 14 | 🇧🇪 BE | Colruyt | colruyt.be |
| 15 | 🇧🇪 BE | Delhaize | delhaize.be |
| 16 | 🇮🇪 IE | Tesco IE | tesco.ie |
| 17 | 🇮🇪 IE | SuperValu | shop.supervalu.ie |
| 18 | 🇮🇪 IE | Dunnes | dunnesstoresgrocery.com |
| 19 | 🇮🇹 IT | Esselunga | spesaonline.esselunga.it |
| 20 | 🇮🇹 IT | Conad | spesaonline.conad.it |
| 21 | 🇩🇰 DK | Nemlig | nemlig.com |
| 22 | 🇳🇴 NO | Meny | meny.no |
| 23 | 🇵🇱 PL | Frisco | frisco.pl |
| 24 | 🇵🇱 PL | Auchan PL | zakupy.auchan.pl |
| 25 | 🇧🇬 BG | Bulmag | bulmag.org |
| 26 | 🇧🇬 BG | eBag | ebag.bg |

Need a supermarket that isn't on this list? [Contact Pepesto](https://www.pepesto.com/contact).

## Where checkout actually happens

This MCP stops at "matched cart with prices." It does **not** automate placing the order on the supermarket's website. Two ways to finish the trip:

- **Pepesto app (recommended).** Open the `redirect_url` returned by `pepesto_oneshot` in a browser, or hand the user the matched-product list from `pepesto_products` and tell them to recreate it in the [Pepesto app](https://www.pepesto.com/) — that's where the hosted checkout flow lives, including login, basket review, and (for some markets) payment.
- **The supermarket's own site.** The user can take the matched product list from `pepesto_products` and add the SKUs directly on tesco.com / coop.ch / etc. Slower, but no Pepesto account needed.

## Pricing & best practices

Pepesto runs on simple pay-as-you-go credits — you only pay for what your agents actually use, and **credits never expire**, so a top-up is yours until you spend it. We also offer discounts for students and early-stage teams, so [say hi](https://www.pepesto.com/contact) if that sounds like you. Full per-call pricing and volume tiers live at <https://www.pepesto.com/pricing/>.

A few tips to get the most out of every credit:

- `pepesto_credits` is free — call it any time for a quick balance read-out.
- `pepesto_predirect` is free and needs no API key — it defers matching and bills the **end user** at checkout, so it costs the API client nothing.
- `pepesto_oneshot`, `pepesto_parse`, `pepesto_suggest`, and `pepesto_products` are the everyday calls (match a recipe, plan a week, compare baskets) and are priced for routine agent use.
- `pepesto_catalog` does a full SKU dump for a supermarket and is the heaviest call. It's the right tool for genuine market analysis or price-comparison dashboards — just **cache the result** for at least a day per supermarket. Not sure you need it? [Tell us about your use case](https://www.pepesto.com/contact) and we'll usually point you to a cheaper path.

## Roadmap

Planned to follow:

- **`pepesto_session`** — wrap `/session` so an agent can build a Pepesto-side checkout session from selected SKUs.
- **`pepesto_checkout`** — wrap `/checkout`, the turn-by-turn browser-automation loop that drives the supermarket's own site (login, add-to-basket, prompt-for-CAPTCHA, etc.). This is the missing piece for fully autonomous shopping.
- **Hosted-checkout handoff** — surface the Pepesto-app deep link as a structured tool result (instead of free text), so MCP clients can render it as a button instead of a URL.

If any of these would unblock you, [tell us](https://www.pepesto.com/contact) — it'll move them up the queue.

## Development

```bash
git clone https://github.com/pepesto-solutions/pepesto-mcp.git
cd pepesto-mcp
npm install
npm run build
npm test
npm run test:coverage
```

Run the inspector against the local build:

```bash
PEPESTO_API_KEY=pep_sk_… npm run inspector
```

## License

The Pepesto MCP server in this repository is licensed under the [MIT License](./LICENSE).


## Deploy

- Deploy the [Pepesto MCP on Glama](https://glama.ai/mcp/servers/pepesto-solutions/pepesto-mcp).
