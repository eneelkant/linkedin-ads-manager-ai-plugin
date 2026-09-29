# Deployment

The MCP server is a standard Node.js HTTP service.

## Container

```bash
docker compose up --build
```

Image requirements:

- non-root user
- no secrets baked in
- `/health` healthcheck
- `NODE_ENV=production`
- env-based LinkedIn credentials

## Platforms

Works on Cloud Run, Render, Railway, Fly.io, and other Node/Docker hosts.

Recommended env:

```bash
NODE_ENV=production
MCP_TRANSPORT=http
PORT=3000
ALLOWED_HOSTS=your-domain.example.com
MCP_HTTP_BEARER_TOKEN=...
LINKEDIN_CAMPAIGNS_TOKEN=...
LINKEDIN_ACCOUNT_ID=...
# optional
LINKEDIN_POSTS_TOKEN=...
```

## HTTPS

Terminate TLS at your platform/load balancer. Clients should call:

```text
https://YOUR-DOMAIN.example.com/mcp
```

## Statelessness

The Streamable HTTP handler creates a fresh MCP server instance per request. Do not store LinkedIn tokens in memory longer than a request needs them.
