# @eneelkant/linkedin-ads-mcp

Canonical LinkedIn Ads MCP server for Claude, ChatGPT, Gemini, and Cursor.

## Transports

| Transport | Flag | Use case |
|-----------|------|----------|
| STDIO | `--stdio` (default) | Local Claude Desktop, Cursor, Gemini CLI |
| Streamable HTTP | `--http` | Remote MCP at `https://YOUR-DOMAIN/mcp` |

## Quick start

```bash
cp ../.env.example ../.env
# fill LINKEDIN_CAMPAIGNS_TOKEN and LINKEDIN_ACCOUNT_ID

npm install
npm run build
npm run start:stdio
# or
PORT=3000 npm run start
```

## npx (after publish)

```bash
npx @eneelkant/linkedin-ads-mcp --stdio
```

This package is prepared for npm publish but is not published automatically by this repository.

## Environment

See root `.env.example`.

Optional:

- `MCP_HTTP_BEARER_TOKEN` — require bearer auth on `/mcp`
- `LINKEDIN_TRUSTED_EXECUTION=true` — allow non-high-risk writes without `confirm=true`
- High-risk tools always require `confirm=true`

## Scripts

```bash
npm test
npm run test:mcp
npm run smoke
npm run typecheck
npm run lint
npm run build
```
