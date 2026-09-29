# Security

## Money safety

LinkedIn Ads tools can spend real money.

- Reads execute normally
- Writes require confirmation unless trusted execution is enabled
- High-risk operations always require `confirm=true` and return a structured preview first
- The server never silently increases budgets or launches campaigns

High-risk tools:

- create/clone campaign
- pause/resume campaign
- update budget
- update targeting
- create organization post

## Secret handling

- `.env` is gitignored; only `.env.example` is committed
- Tokens are redacted in logs and tool errors
- MCP responses never include access tokens or client secrets
- Prefer deployment secret stores over committing credentials

## Remote exposure

If `/mcp` is on the public internet:

1. Use HTTPS
2. Set `MCP_HTTP_BEARER_TOKEN`
3. Configure `ALLOWED_HOSTS`
4. Keep rate limiting enabled (default in-process limiter)

## CI protections

GitHub Actions runs lint, typecheck, tests, build, and a repository secret scan that fails on tracked `.env` files or credential-like patterns.
