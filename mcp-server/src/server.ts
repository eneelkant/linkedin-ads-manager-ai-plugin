import { McpServer } from "@modelcontextprotocol/server";
import { registerLinkedInTools } from "./tools/register.js";

export const SERVER_NAME = "linkedin-ads-manager";
export const SERVER_VERSION = "1.0.0";

export function createLinkedInMcpServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerLinkedInTools(server);
  return server;
}
