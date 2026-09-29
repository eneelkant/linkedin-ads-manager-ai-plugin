# Gemini setup

## Streamable HTTP

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "httpUrl": "https://YOUR-DOMAIN.example.com/mcp"
    }
  }
}
```

## STDIO

```json
{
  "mcpServers": {
    "linkedin-ads-manager": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js", "--stdio"],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

See `clients/gemini/` for copy-paste examples.
