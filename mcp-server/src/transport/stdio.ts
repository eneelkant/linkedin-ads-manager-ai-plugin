import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createLinkedInMcpServer } from "../server.js";
import { logger } from "../utils/logger.js";

export async function startStdioServer(): Promise<{ close: () => Promise<void> }> {
  const handle = serveStdio(() => createLinkedInMcpServer(), {
    legacy: "serve",
    onerror: (error) => {
      logger.error("mcp.stdio.error", { error: error.message });
    },
  });
  logger.info("mcp.stdio.ready", { transport: "stdio" });
  return { close: () => handle.close() };
}
