# Claude client

Claude can use this project in two different ways. They are not the same installation mechanism.

## A) Claude plugin (local Cowork / plugin install)

Preserves the existing workflow:

1. Install the public GitHub plugin / marketplace entry
2. Attach a local credentials folder
3. Run `/linkedin-setup`
4. Use the `linkedin-ads-manager` skill (Python CLI)

See root README and `docs/claude.md`.

## B) Remote MCP / custom connector

Point Claude at a deployed Streamable HTTP endpoint:

```text
https://YOUR-DOMAIN.example.com/mcp
```

Configure authentication according to your deployment (`MCP_HTTP_BEARER_TOKEN` recommended).

Claude remote MCP does **not** install by cloning GitHub alone — the MCP server must be reachable over HTTPS.
