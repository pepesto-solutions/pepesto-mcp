# Dockerfile for the Pepesto MCP server, built for Glama (https://glama.ai).
# Mirrors the settings used in the Glama deployment form:
#   Base image: debian:trixie-slim   (GLIBC 2.41+)
#   Node.js:    25
#   Build:      npm install && npm run build
#   Cmd:        node ./dist/index.js
#   Env:        PEPESTO_API_KEY (required) — see README "Getting an API key"
FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_25.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

CMD ["node", "./dist/index.js"]
