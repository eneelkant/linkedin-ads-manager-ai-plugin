# Authentication

## Campaign management (required)

| Variable | Purpose |
|----------|---------|
| `LINKEDIN_CAMPAIGNS_TOKEN` | OAuth access token from a Marketing Developer Platform app |
| `LINKEDIN_ACCOUNT_ID` | Numeric ad account ID |

Required OAuth scopes:

- `rw_ads`
- `r_ads_reporting`

Also whitelist the ad account in the LinkedIn Developer Portal under Products → View Ad Accounts.

## Organization posting (optional)

| Variable | Purpose |
|----------|---------|
| `LINKEDIN_POSTS_TOKEN` | OAuth access token from a Community Management API app |

Required scope:

- `w_organization_social`

LinkedIn does **not** allow a single developer app to hold both Marketing Developer Platform and Community Management API products. Use two apps when you need both capabilities.

Community Management API is **not** required for Ads campaign management.

## Where credentials live

1. Process environment variables (preferred for remote deployments)
2. Local `.env` (gitignored) for local STDIO installs
3. Claude `/linkedin-setup` workflow writing `.env` into the attached Cowork folder

Never commit credentials. Never put LinkedIn access tokens into client MCP JSON committed to git.

## Remote MCP auth

For public HTTPS deployments, set:

```bash
MCP_HTTP_BEARER_TOKEN=long-random-secret
```

Clients send:

```http
Authorization: Bearer long-random-secret
```

LinkedIn tokens remain server-side.

## OAuth-ready future

The auth layer is environment-driven and does not hardcode client secrets. Future OAuth browser/device flows can populate the same env vars (`LINKEDIN_CAMPAIGNS_TOKEN`, etc.) without changing tool contracts.
