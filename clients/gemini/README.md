# Gemini CLI

Gemini CLI can use either Streamable HTTP or local STDIO via `mcpServers`.

## Remote (Streamable HTTP)

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "httpUrl": "https://YOUR-DOMAIN.example.com/mcp"
    }
  }
}
```

If your Gemini build expects `url` instead of `httpUrl`, use the field name documented for your CLI version.

## Local STDIO

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js", "--stdio"],
      "env": {
        "LINKEDIN_CAMPAIGNS_TOKEN": "",
        "LINKEDIN_ACCOUNT_ID": ""
      }
    }
  }
}
```

Prefer loading secrets from a local `.env` / secret manager — do not commit tokens.
