import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { readCredentialStatus } from "../auth/credentials.js";
import { createLinkedInMcpServer, SERVER_NAME, SERVER_VERSION } from "../server.js";
import { logger } from "../utils/logger.js";
import { createDefaultRateLimiter } from "../utils/rateLimit.js";
import { redactSecrets } from "../utils/redact.js";

function parseAllowedHosts(): string[] {
  const fromEnv = (process.env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return ["localhost", "127.0.0.1", "[::1]", ...fromEnv];
}

function clientKey(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    "anonymous"
  );
}

function checkBearerAuth(req: Request, res: Response): boolean {
  const required = process.env.MCP_HTTP_BEARER_TOKEN?.trim();
  if (!required) return true;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return false;
  }
  const provided = header.slice("Bearer ".length).trim();
  if (provided !== required) {
    res.status(401).json({ error: "Invalid bearer token" });
    return false;
  }
  return true;
}

export async function startHttpServer(port = Number(process.env.PORT ?? 3000)): Promise<{
  close: () => Promise<void>;
}> {
  const allowedHosts = parseAllowedHosts();
  const app = createMcpExpressApp({ allowedHosts });
  const rateLimiter = createDefaultRateLimiter();

  const handler = createMcpHandler(() => createLinkedInMcpServer(), {
    responseMode: "json",
  });
  const node = toNodeHandler(handler);

  app.get("/health", (_req, res) => {
    const creds = readCredentialStatus();
    res.status(200).json({
      status: "ok",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      credentials: {
        campaignsConfigured: creds.campaignsConfigured,
        accountConfigured: creds.accountConfigured,
        postsConfigured: creds.postsConfigured,
        // Never include token values
      },
    });
  });

  app.all("/mcp", (req: Request, res: Response) => {
    try {
      if (!checkBearerAuth(req, res)) return;

      const limit = rateLimiter.check(clientKey(req));
      res.setHeader("X-RateLimit-Remaining", String(limit.remaining));
      if (!limit.allowed) {
        res.status(429).json({
          error: "Rate limit exceeded",
          retryAfterMs: limit.resetMs,
        });
        return;
      }

      logger.info("mcp.http.request", {
        method: req.method,
        path: "/mcp",
        contentType: req.headers["content-type"],
      });
      void node(req, res, req.body);
    } catch (error) {
      logger.error("mcp.http.error", {
        error: redactSecrets(error instanceof Error ? error.message : "unknown"),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  const server = app.listen(port, () => {
    logger.info("mcp.http.listening", {
      port,
      health: "/health",
      mcp: "/mcp",
      allowedHosts,
    });
  });

  const close = async () => {
    await handler.close();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  const enableSignals = process.env.MCP_HTTP_HANDLE_SIGNALS !== "0";
  if (enableSignals) {
    const shutdown = async (signal: string) => {
      logger.info("mcp.http.shutdown", { signal });
      try {
        await close();
        process.exit(0);
      } catch (error) {
        logger.error("mcp.http.shutdown_failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
        process.exit(1);
      }
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  }

  return { close };
}
