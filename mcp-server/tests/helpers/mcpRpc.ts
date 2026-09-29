import { createMcpHandler } from "@modelcontextprotocol/server";

export function parseMcpResponseBody(text: string, contentType: string | null): any {
  if ((contentType ?? "").includes("text/event-stream") || text.startsWith("event:")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter(Boolean);
    if (!dataLines.length) {
      throw new Error(`SSE response missing data lines: ${text}`);
    }
    return JSON.parse(dataLines[dataLines.length - 1]!);
  }
  return JSON.parse(text);
}

export async function mcpRpc(
  handler: ReturnType<typeof createMcpHandler>,
  body: Record<string, unknown>,
  id = 1,
): Promise<any> {
  const response = await handler.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, ...body }),
    }),
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MCP RPC failed (${response.status}): ${text}`);
  }
  return parseMcpResponseBody(text, response.headers.get("content-type"));
}
