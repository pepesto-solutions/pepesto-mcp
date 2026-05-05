#!/usr/bin/env bash
# tests/docker.sh — companion to the vitest suites in this directory.
# Run with `npm run test:docker` (or `bash tests/docker.sh`).
#
# Vitest covers the TS code (server wiring, schemas, client error paths).
# This script covers the *built artifact*: build the Glama Dockerfile and
# smoke-test it the same way Glama will.
#
# Transport: this MCP server speaks JSON-RPC over stdio (no port, no EXPOSE).
# Glama spawns `docker run -i` per session, pipes its proxy through stdin/stdout,
# and bridges that to HTTPS/SSE for the MCP client. The `-i` flag below mirrors
# that — it keeps stdin attached so we can feed JSON-RPC frames in.
#
# Checks:
#   1. image builds
#   2. without a key: server still starts and tools/list returns every tool
#      we register in src/server.ts (so MCP clients / Glama's startup probe
#      can discover capabilities before credentials are configured)
#   3. if PEPESTO_API_KEY is set in the host env: actually call pepesto_credits
#      — the only free tool behind the API key — to verify the server can reach the live API
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE=pepesto-mcp:glama-test
EXPECTED_TOOLS=(
    pepesto_oneshot
    pepesto_parse
    pepesto_suggest
    pepesto_products
    pepesto_catalog
    pepesto_credits
)

echo "==> docker build"
docker build -t "$IMAGE" .

echo "==> initialize + tools/list (no API key)"
resp=$({
    echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}'
    echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
    echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
} | docker run --rm -i "$IMAGE")
echo "$resp"

echo "$resp" | grep -q '"serverInfo"' \
    || { echo "FAIL: no serverInfo in initialize response"; exit 1; }

for tool in "${EXPECTED_TOOLS[@]}"; do
    echo "$resp" | grep -q "\"$tool\"" \
        || { echo "FAIL: tool $tool missing from tools/list"; exit 1; }
done

echo "==> OK (${#EXPECTED_TOOLS[@]} tools listed without a key)"

# Real API call — opt-in. Set PEPESTO_API_KEY in your shell before running.
# pepesto_credits is the free balance check, safe to spam.
if [ -n "${PEPESTO_API_KEY:-}" ]; then
    echo "==> tools/call pepesto_credits (live API, key from host env)"
    resp=$({
        echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}'
        echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
        echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pepesto_credits","arguments":{}}}'
    } | docker run --rm -i -e PEPESTO_API_KEY "$IMAGE")
    echo "$resp"

    # The credits call returned a JSON-RPC result and was not flagged as an error.
    echo "$resp" | grep -q '"id":3' \
        || { echo "FAIL: no response to tools/call (id 3)"; exit 1; }
    echo "$resp" | grep -q '"isError":true' \
        && { echo "FAIL: pepesto_credits returned isError:true (auth or network problem)"; exit 1; }

    echo "==> OK (live pepesto_credits call succeeded)"
else
    echo "==> SKIP live API call (set PEPESTO_API_KEY in your shell to enable)"
fi
