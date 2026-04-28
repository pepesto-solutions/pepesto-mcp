# Pepesto MCP Server

MCP server for the [Pepesto API](https://www.pepesto.com/ai-grocery-shopping-agent/) — turn recipes into real supermarket carts across 26 European supermarkets.

## Quick install

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pepesto": {
      "command": "npx",
      "args": ["-y", "@pepesto-solutions/pepesto-mcp"],
      "env": { "PEPESTO_API_KEY": "pep_sk_…" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add pepesto -e PEPESTO_API_KEY=pep_sk_… -- npx -y @pepesto-solutions/pepesto-mcp
```

## API cost guidance

Every Pepesto call drives live supermarket data and LLM processing — [there is no free tier](https://www.pepesto.com/pricing/#faq-free-tier). Credits don't expire, and students or early-stage teams can [reach out](https://www.pepesto.com/contact) for a discount. Per-call pricing and volume discounts: <https://www.pepesto.com/pricing/>.

To keep the bill predictable:

- `pepesto_session` is expensive — only call after the user has confirmed the final basket.
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
| `pepesto_oneshot` | `POST /oneshot` | One-shot recipe → checkout-ready cart. Returns a `redirect_url`. |
| `pepesto_parse` | `POST /parse` | Parse a URL/text/image recipe into structured ingredients + `KgToken`. |
| `pepesto_suggest` | `POST /suggest` | Search Pepesto's 1M+ recipe graph. Returned images are licensed for 24 h. |
| `pepesto_products` | `POST /products` | Map `KgToken`s + supermarket to concrete products with prices. |
| `pepesto_session` | `POST /session` | Build a checkout session from selected SKUs. Don't call speculatively. |
| `pepesto_catalog` | `POST /catalog` | Full SKU dump for a supermarket. Only when explicitly requested; cache results. |
| `pepesto_credits` | `POST /credits` | Check remaining credits. Free. |

`/checkout` is **not** wrapped — it's a turn-by-turn browser-automation loop and is out of scope for this server. `/link` isn't exposed either: an agent doesn't need it once the key is in `PEPESTO_API_KEY` (see [Getting an API key](#getting-an-api-key) above).

## Example agent prompts

- *"Find a vegan pasta recipe for two and add the ingredients to my Coop (coop.ch) cart."*
  → `pepesto_suggest` → `pepesto_products` → `pepesto_session` → user opens `redirect_url`.
- *"Parse this recipe URL and tell me what's in it: https://www.bbcgoodfood.com/recipes/pizza-margherita-4-easy-steps"*
  → `pepesto_parse`.
- *"Use Pepesto to build a Tesco cart from this recipe and also add milk and bananas."*
  → `pepesto_oneshot` with `content_urls` + `content_text` + `supermarket_domain: "tesco.com"`.

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

## Important: /checkout is not automated

Pepesto's `/oneshot` and `/session` endpoints return a `redirect_url`. The user must open that URL, verify the cart, and complete checkout (login + payment) themselves on the supermarket's website. This server does not implement `/checkout` — that endpoint drives a per-turn browser-automation loop and is out of scope here.

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
