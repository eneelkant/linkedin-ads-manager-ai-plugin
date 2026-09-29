# Architecture

```text
                    Claude
                       │
                    ChatGPT
                       │
                    Gemini
                       │
                    Cursor
                       │
                       ▼
                ┌──────────────┐
                │  MCP Server  │
                ├──────────────┤
                │ LinkedIn API │
                │ Safety Layer │
                │ Auth Layer   │
                │ Validation   │
                └──────┬───────┘
                       │
                       ▼
                LinkedIn APIs
```

## One canonical MCP server

All AI clients talk to **one** implementation: `mcp-server/` (`@eneelkant/linkedin-ads-mcp`).

Client folders under `clients/` and `examples/` contain only configuration, manifests, and instructions. They do not reimplement LinkedIn API business logic.

The Claude plugin skill under `linkedin-ads-manager/` remains available for the existing Cowork/plugin workflow (Python CLI). New cross-platform integrations should use the MCP server.

## Transports

| Transport | Entrypoint | Clients |
|-----------|------------|---------|
| STDIO | `node dist/index.js --stdio` | Claude Desktop / local Cursor / Gemini CLI |
| Streamable HTTP | `POST/GET /mcp` | ChatGPT remote MCP, Claude remote connectors, hosted Cursor/Gemini |

SSE is not the primary remote architecture. Streamable HTTP is.

## Credential isolation

- LinkedIn tokens live in environment variables / local `.env` / deployment secrets
- Tokens are never returned by MCP tools
- Logs redact bearer tokens and secret-like values
- Optional `MCP_HTTP_BEARER_TOKEN` protects public `/mcp`

## Confirmation model

- **Reads**: execute normally
- **Writes**: require `confirm=true` unless `LINKEDIN_TRUSTED_EXECUTION=true`
- **High-risk** (create/clone/pause/resume/budget/targeting/org post): always require `confirm=true` and return a structured preview first

The server never silently increases budgets or launches campaigns.

## API error handling

LinkedIn HTTP failures are mapped to typed errors:

- validation (bad IDs)
- API status errors (message redacted)
- rate limits (`Retry-After`)
- timeouts

Tools return JSON error objects suitable for model recovery without exposing secrets.
