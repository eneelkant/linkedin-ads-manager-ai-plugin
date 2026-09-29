# Production image for LinkedIn Ads Manager MCP (Streamable HTTP)
FROM node:22-alpine AS build

WORKDIR /app
COPY mcp-server/package.json mcp-server/package-lock.json ./mcp-server/
WORKDIR /app/mcp-server
RUN npm ci

COPY mcp-server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    PORT=3000

WORKDIR /app
RUN addgroup -S mcp && adduser -S mcp -G mcp

COPY --from=build /app/mcp-server/package.json ./package.json
COPY --from=build /app/mcp-server/package-lock.json ./package-lock.json
COPY --from=build /app/mcp-server/node_modules ./node_modules
COPY --from=build /app/mcp-server/dist ./dist
COPY --from=build /app/mcp-server/README.md ./README.md

USER mcp
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js", "--http"]
