# LinkedIn Ads Manager MCP

AI-powered LinkedIn Ads management for Claude, ChatGPT, Gemini and Cursor.

Manage LinkedIn advertising campaigns through the Model Context Protocol (MCP) — with a backwards-compatible Claude plugin for existing Cowork workflows.

> Talk to your LinkedIn Ads account through the AI client you already use.

---

## 1. What it does

- Inspect ad accounts, campaigns, creatives, budgets, and targeting
- Create/clone/pause/resume campaigns with confirmation-gated safety
- Pull spend, conversions, and operational audits
- Optionally publish LinkedIn organization posts when Community Management credentials are configured

## 2. Architecture

One canonical MCP server. Thin client configs. No duplicated LinkedIn API business logic across clients.

```text
Claude / ChatGPT / Gemini / Cursor
                │
                ▼
         MCP Server (STDIO or Streamable HTTP)
                │
                ▼
         LinkedIn Marketing / Community APIs
```

Details: [`docs/architecture.md`](docs/architecture.md)

## 3. Supported AI clients

| Client | Local STDIO | Remote Streamable HTTP | Notes |
|--------|-------------|------------------------|-------|
| Claude / Claude Desktop / Cowork | Yes (plugin skill + MCP) | Yes (remote connector) | Existing `/linkedin-setup` plugin preserved |
| ChatGPT / OpenAI apps | No (remote MCP) | Yes | Needs public HTTPS `/mcp` |
| Gemini / Gemini CLI | Yes | Yes | `mcpServers` config |
| Cursor / Cursor Agent / CLI | Yes | Yes | `.cursor/mcp.json` |

Installation mechanisms differ by client. GitHub clone is not required for every path.

## 4. Supported LinkedIn capabilities

### Campaign management

Scopes: `rw_ads`, `r_ads_reporting`

Accounts, campaigns, campaign groups, creatives, targeting, budgets, analytics, audits.

### Organization posting (optional)

Scope: `w_organization_social`

Only exposed when `LINKEDIN_POSTS_TOKEN` is configured.

Community Management API is **not** required for Ads.

## 5. Installation

### Method A — Claude Plugin

Install from this public repository / Claude plugin marketplace-compatible structure. Then run `/linkedin-setup`.

### Method B — Local MCP

```bash
git clone https://github.com/eneelkant/linkedin-ads-manager-ai-plugin.git
cd linkedin-ads-manager-ai-plugin
cp .env.example .env
npm install
npm run build
npm run start:stdio
```

### Method C — npm package (prepared)

Package name: `@eneelkant/linkedin-ads-mcp`

```bash
npx @eneelkant/linkedin-ads-mcp --stdio
```

Publishing is prepared in `mcp-server/package.json` but **not** executed by this repo automatically.

### Method D — Docker image

```bash
docker compose up --build
```

### Method E — Remote MCP (preferred no-GitHub-login UX)

Deploy the server, then point clients at:

```text
https://YOUR-DOMAIN.example.com/mcp
```

AI client → Remote MCP endpoint → LinkedIn Ads MCP → LinkedIn Marketing API

GitHub remains the source/distribution project, not an authentication dependency for remote MCP usage.

## 6. Authentication

```bash
LINKEDIN_CAMPAIGNS_TOKEN=
LINKEDIN_ACCOUNT_ID=
LINKEDIN_POSTS_TOKEN=   # optional
```

See [`docs/authentication.md`](docs/authentication.md). Never commit secrets.

## 7. Local MCP

```bash
npm run start:stdio
```

Configure Claude Desktop / Cursor / Gemini with a `command`/`args` STDIO block pointing at `mcp-server/dist/index.js`.

## 8. Remote MCP

```bash
PORT=3000 npm start
# or docker compose up --build
curl http://localhost:3000/health
```

Production endpoint shape:

```text
https://YOUR-DOMAIN.example.com/mcp
```

## 9. Claude setup

See [`docs/claude.md`](docs/claude.md) and `clients/claude/`.

- `/linkedin-setup` still works
- `linkedin-ads-manager` skill still works
- Optional: connect Claude to remote MCP separately

## 10. ChatGPT setup

See [`docs/chatgpt.md`](docs/chatgpt.md). Requires a publicly reachable HTTPS MCP server.

## 11. Gemini setup

See [`docs/gemini.md`](docs/gemini.md) and `clients/gemini/`.

## 12. Cursor setup

See [`docs/cursor.md`](docs/cursor.md) and `clients/cursor/mcp.json`.

## 13. LinkedIn Developer App setup

1. Create App 1 with **Marketing Developer Platform**
2. Request `rw_ads` and `r_ads_reporting`
3. Whitelist your ad account under Products → View Ad Accounts
4. Generate an access token via Auth → OAuth 2.0 tools

## 14. Ad Account setup

Set `LINKEDIN_ACCOUNT_ID` to the numeric account ID from Campaign Manager.

## 15. Required OAuth scopes

| Capability | Scopes |
|------------|--------|
| Campaign management | `rw_ads`, `r_ads_reporting` |
| Organization posting | `w_organization_social` |

## 16. Organization posting setup

1. Create a **separate** developer app with Community Management API
2. Request `w_organization_social`
3. Set `LINKEDIN_POSTS_TOKEN`

## 17. Security

- Confirmation previews for high-impact actions
- Token redaction in logs/errors
- Optional bearer auth for remote `/mcp`
- No arbitrary `linkedin_api_call` tool

Details: [`docs/security.md`](docs/security.md)

## 18. Tool reference

Account: `linkedin_get_ad_account`, `linkedin_list_ad_accounts`

Campaigns: `linkedin_list_campaigns`, `linkedin_get_campaign`, `linkedin_create_campaign`, `linkedin_clone_campaign`, `linkedin_update_campaign`, `linkedin_pause_campaign`, `linkedin_resume_campaign`

Campaign groups: `linkedin_list_campaign_groups`, `linkedin_get_campaign_group`, `linkedin_create_campaign_group`, `linkedin_update_campaign_group`

Creatives: `linkedin_list_creatives`, `linkedin_get_creative`, `linkedin_create_creative`, `linkedin_update_creative`

Targeting/budgets: `linkedin_get_campaign_targeting`, `linkedin_update_campaign_targeting`, `linkedin_get_campaign_budget`, `linkedin_update_campaign_budget`

Reporting: `linkedin_get_campaign_analytics`, `linkedin_get_account_analytics`, `linkedin_get_spend`, `linkedin_get_leads`, `linkedin_get_conversions`

Auditing: `linkedin_audit_account`, `linkedin_audit_campaign`

Organization (optional): `linkedin_get_organization`, `linkedin_create_organization_post`, `linkedin_update_organization_post`

## 19. Examples

See `examples/{claude,chatgpt,gemini,cursor}/`.

## 20. Troubleshooting

See [`docs/troubleshooting.md`](docs/troubleshooting.md).

## 21. Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run test:mcp
npm run smoke
npm run build
npm run security:scan
```

## 22. Deployment

See [`docs/deployment.md`](docs/deployment.md).

## 23. Contributing

1. Branch from `main`
2. Keep Claude plugin backwards compatible
3. Put LinkedIn API logic only in `mcp-server/`
4. Add/adjust tests for tool and safety changes
5. Do not commit secrets

## 24. License

MIT — see [`LICENSE`](LICENSE).

---

**Version:** 1.0.0 (major cross-platform MCP release; previous Claude plugin was 0.2.4)
