# Docker

Build and run the Streamable HTTP MCP server locally:

```bash
cp .env.example .env
# edit .env with LinkedIn credentials

docker compose up --build
curl http://localhost:3000/health
```

Remote clients should point at:

```text
https://YOUR-DOMAIN.example.com/mcp
```

Do not bake secrets into the image. Pass credentials via environment variables or an untracked `.env` file at runtime.
