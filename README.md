# Pepesto MCP Server

<!-- mcp-name: io.github.pepesto-solutions/pepesto-mcp -->

MCP server for the [Pepesto API](https://www.pepesto.com/ai-grocery-shopping-agent/) — match recipes to real supermarket products across 26 European supermarkets. The MCP focuses on the **recipe → matched cart** half of the workflow (parse / search / map ingredients to SKUs / check catalogs); for actually placing the order, hand the user off to the [Pepesto app](https://www.pepesto.com/) where they can review and check out.

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

## API cost guidance

Every Pepesto call drives live supermarket data and LLM processing — [there is no free tier](https://www.pepesto.com/pricing/#faq-free-tier). Credits don't expire, and students or early-stage teams can [reach out](https://www.pepesto.com/contact) for a discount. Per-call pricing and volume discounts: <https://www.pepesto.com/pricing/>.

To keep the bill predictable:

- `pepesto_catalog` is the most expensive call. Use it only when the user has explicitly asked for a catalog dump or market analysis, and **cache the result** for at least a day per supermarket. Most users who reach for `/catalog` early on don't actually need it — [tell us about your use case](https://www.pepesto.com/contact) and we'll usually suggest a cheaper path.
- `pepesto_credits` is free; call it from your agent for a balance read-out.

## Getting an API key

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
| `pepesto_oneshot`   | `POST /oneshot`   | One-shot recipe → matched cart with a `redirect_url` to the Pepesto app for checkout. |
| `pepesto_parse`     | `POST /parse`     | Parse a URL/text/image recipe into structured ingredients + `KgToken`. |
| `pepesto_suggest`   | `POST /suggest`   | Search Pepesto's 1M+ recipe graph. |
| `pepesto_products`  | `POST /products`  | Map `KgToken`s + supermarket to concrete products with prices. |
| `pepesto_catalog`   | `POST /catalog`   | Full SKU dump for a supermarket. Only when explicitly requested; cache results. |
| `pepesto_credits`   | `POST /credits`   | Check remaining credits. Free. |

The MCP stops at "matched cart with prices." For actual checkout (review, payment, delivery), users continue in the **[Pepesto app](https://www.pepesto.com/)** — open the `redirect_url` returned by `pepesto_oneshot`, or hand the user the matched-product list from `pepesto_products` and tell them to recreate it there. `/session`, `/checkout`, and `/link` are intentionally not wrapped; see [Roadmap](#roadmap) for what's planned.

## Example conversations

### Quick: recipe URL → matched cart, hand off to Pepesto app

The fastest path. One tool call, one link to the Pepesto app where the user finishes checkout.

> **User:** Use the BBC Good Food pizza margherita recipe to build a Tesco cart, and also add sparkling water and olive oil.
>
> **Assistant:** *[Uses `pepesto_oneshot` with `content_urls`, `content_text`, `supermarket_domain: "tesco.com"`]*
>
> **Assistant:** Cart matched. Open this link in the Pepesto app to review and check out at Tesco: `<redirect_url>`.

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
> **Assistant:** I matched 8 ingredients at Coop — cashews CHF 4.20, penne CHF 1.95, ... — total CHF 18.40. To check out, open the [Pepesto app](https://www.pepesto.com/) and search for *Creamy Cashew Penne* (or paste the recipe link).

### Parse a specific recipe → matched cart

When the user already has a recipe URL or text in mind. The MCP returns the matched product list; the user finishes in the app.

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
> **Assistant:** Matched 8 ingredients at Sainsbury's — total £6.40. Open the [Pepesto app](https://www.pepesto.com/) to check out at Sainsbury's, or use the cart preview yourself on sainsburys.co.uk.

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
> **Assistant:** Combined match: 24 unique ingredients (some shared across recipes), estimated total €68.40 at Delhaize. To turn this into an actual basket, open the [Pepesto app](https://www.pepesto.com/) — the recipes you picked are searchable there.

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

Last resort, only on explicit request. Cache aggressively — see [Cost guidance](#api-cost-guidance) above.

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
