# Cursor

## Project-level config

Copy `.cursor/mcp.json` (see repository root example under `clients/cursor/mcp.json`) into your project:

Remote:

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "url": "https://YOUR-DOMAIN.example.com/mcp"
    }
  }
}
```

Local STDIO:

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "command": "node",
      "args": [
        "${workspaceFolder}/mcp-server/dist/index.js",
        "--stdio"
      ],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

## Global config

Cursor also supports a user-global MCP config. Use the same `mcpServers` shape; only the file location differs by Cursor version.

Do not commit real credentials.
