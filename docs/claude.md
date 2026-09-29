# Claude setup

## Plugin workflow (existing)

1. Create a local folder for credentials, e.g. `~/linkedin-ads`
2. Attach it to your Claude Cowork project
3. Install the plugin from this public repository / marketplace entry
4. Run `/linkedin-setup`
5. Use the `linkedin-ads-manager` skill

This path continues to use the Python CLI under `linkedin-ads-manager/skills/linkedin-ads-manager/`.

## Remote MCP connector

1. Deploy `mcp-server` with Streamable HTTP
2. Add a Claude remote MCP / custom connector pointing to `https://YOUR-DOMAIN.example.com/mcp`
3. Keep LinkedIn tokens on the server

Plugin install ≠ remote MCP install. Configure the mechanism your Claude surface supports.
