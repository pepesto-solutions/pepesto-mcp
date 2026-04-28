# Recorded Pepesto API fixtures

Each `*.json` file in this directory is a verbatim recording of one HTTP exchange against the real Pepesto API. The fixture-replay tests in `tests/fixtures.test.ts` use them to verify that `PepestoClient` still handles current API responses correctly.

## Format

```jsonc
{
  "name": "credits_ok",
  "request": {
    "method": "POST",
    "endpoint": "/credits",
    "body_raw": "{}"           // verbatim string sent on the wire
  },
  "response": {
    "status": 200,
    "body": "{...}"            // verbatim response body string
  }
}
```

## Refreshing

Fixtures here are recordings against the real Pepesto API. When the API changes, re-record them and commit the diff. Tokens and real-world URLs in committed fixtures are redacted to deterministic placeholders (`kg_<8hex>`, `sk_<8hex>`, `sid_<8hex>`, `https://example.com/<8hex>`).

## Redaction

Fixtures are committed with all real values replaced by deterministic placeholders:

- `kg_token`, `recipe_kg_tokens[]` → `kg_<8 hex>`
- `session_token` → `sk_<8 hex>`
- `session_id` → `sid_<8 hex>`
- Every real-world URL → `https://example.com/<8 hex>`

The same input always maps to the same placeholder, so chains stay consistent across files (e.g. the `kg_token` returned by `parse_url_ok` is the same string used in `products_ok`'s request).

## What the test does with each fixture

- **2xx response** → asserts `client.post(...)` resolves without throwing.
- **non-2xx response** → asserts `client.post(...)` throws `PepestoApiError` with the recorded `status`, `endpoint`, and `body`.
- **All fixtures** → asserts our outgoing request shape (URL, method, `Authorization: Bearer …`, `Content-Type: application/json`, body) matches the recorded request.
- **Selected happy paths** (`credits_ok`, `parse_url_ok`, `suggest_ok`, `oneshot_ok`, `products_ok`, `session_ok`, `catalog_ok`) → asserts the specific response field shapes downstream code depends on, e.g. `parse_url_ok.recipe.kg_token` must be a string.
