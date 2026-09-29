#!/usr/bin/env node
import { loadCredentialEnvironment } from "./auth/credentials.js";
import { logger } from "./utils/logger.js";
import { startHttpServer } from "./transport/http.js";
import { startStdioServer } from "./transport/stdio.js";

function printHelp(): void {
  console.error(`LinkedIn Ads Manager MCP

Usage:
  linkedin-ads-mcp --stdio          Start STDIO transport (local Claude/Cursor/Gemini)
  linkedin-ads-mcp --http           Start Streamable HTTP transport on PORT (default 3000)
  linkedin-ads-mcp --help           Show help

Environment:
  LINKEDIN_CAMPAIGNS_TOKEN   Required for campaign tools
  LINKEDIN_ACCOUNT_ID        Required numeric ad account ID
  LINKEDIN_POSTS_TOKEN       Optional Community Management token
  MCP_HTTP_BEARER_TOKEN      Optional bearer auth for remote /mcp
  MCP_TRANSPORT              http|stdio (optional override)
  PORT                       HTTP port (default 3000)
  ALLOWED_HOSTS              Comma-separated extra Host header values
`);
}

function resolveTransport(args: string[]): "http" | "stdio" {
  if (args.includes("--help") || args.includes("-h")) {
    return "stdio";
  }
  if (args.includes("--http")) return "http";
  if (args.includes("--stdio")) return "stdio";
  const envTransport = (process.env.MCP_TRANSPORT ?? "").toLowerCase();
  if (envTransport === "http") return "http";
  if (envTransport === "stdio") return "stdio";
  // Hosting platforms typically inject PORT — prefer HTTP there.
  if (process.env.PORT) return "http";
  return "stdio";
}

async function main(): Promise<void> {
  loadCredentialEnvironment();
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const transport = resolveTransport(args);
  if (transport === "http") {
    const port = Number(process.env.PORT ?? 3000);
    await startHttpServer(port);
    return;
  }

  await startStdioServer();
}

main().catch((error) => {
  logger.error("mcp.fatal", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
