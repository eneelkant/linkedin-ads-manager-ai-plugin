# Troubleshooting

## Missing credentials

```text
LINKEDIN_CAMPAIGNS_TOKEN is not configured
```

Set env vars or create `.env` from `.env.example`. For Claude plugin users, run `/linkedin-setup`.

## Invalid account / campaign ID

IDs must be numeric (URN suffixes accepted). Non-numeric values return validation errors.

## 401 / 403 from LinkedIn

- Token expired — regenerate via LinkedIn Developer Portal OAuth tools
- Missing scopes (`rw_ads`, `r_ads_reporting`)
- Ad account not whitelisted on the developer app

## Organization posting fails

`LINKEDIN_POSTS_TOKEN` missing or lacking `w_organization_social`. Ads features do not require this token.

## Confirmation previews instead of execution

Expected for write/high-risk tools. Review the preview, then re-call with `confirm=true`.

## Remote MCP 401

Provide `Authorization: Bearer <MCP_HTTP_BEARER_TOKEN>` if the server requires it.

## Rate limits

LinkedIn or local MCP limiter returned 429. Wait for `Retry-After` / `retryAfterMs` and retry.
