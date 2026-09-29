# ChatGPT setup

ChatGPT supports remote MCP over HTTPS.

1. Deploy this MCP server so `/mcp` is publicly reachable
2. Verify `GET /health`
3. Create a ChatGPT MCP connector/action pointing at `https://YOUR-DOMAIN.example.com/mcp`
4. If `MCP_HTTP_BEARER_TOKEN` is set, configure the matching bearer header

Cloning GitHub is optional and only needed if you self-host from source. End users of a deployed endpoint do not need a GitHub login.
