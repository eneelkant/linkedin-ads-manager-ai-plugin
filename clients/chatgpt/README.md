# ChatGPT / OpenAI remote MCP

ChatGPT uses a **remote** MCP endpoint over HTTPS. Installing or starring this GitHub repository does not install an MCP server into ChatGPT.

## Endpoint

```text
https://YOUR-DOMAIN.example.com/mcp
```

## Requirements

1. Deploy this project's MCP server (Docker / Cloud Run / Render / Railway / Fly.io / Node host)
2. Ensure `GET /health` is healthy
3. Configure LinkedIn credentials in the **deployment environment** (never in ChatGPT prompts)
4. Prefer `MCP_HTTP_BEARER_TOKEN` and configure the matching bearer token in the ChatGPT connector settings

## Notes

- Transport: Streamable HTTP
- No GitHub login is required to call a public remote MCP endpoint
- GitHub is only needed if you choose to clone/build from source yourself
