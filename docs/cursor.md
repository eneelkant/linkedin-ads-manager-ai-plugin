# Cursor setup

## Project config (`.cursor/mcp.json`)

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

Build first: `npm install && npm run build`.

Examples live in `clients/cursor/`.
