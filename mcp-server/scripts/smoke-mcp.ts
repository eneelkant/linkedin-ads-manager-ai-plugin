import { createMcpHandler } from "@modelcontextprotocol/server";
import { createLinkedInMcpServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";
import { EXPECTED_TOOL_NAMES } from "../src/tools/register.js";

function parseBody(text: string, contentType: string | null): any {
  if ((contentType ?? "").includes("text/event-stream") || text.startsWith("event:")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    return JSON.parse(dataLines[dataLines.length - 1]!);
  }
  return JSON.parse(text);
}

async function main(): Promise<void> {
  const handler = createMcpHandler(() => createLinkedInMcpServer(), {
    responseMode: "json",
  });

  const init = await handler.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "smoke", version: "1.0.0" },
        },
      }),
    }),
  );

  const initText = await init.text();
  if (!init.ok) {
    throw new Error(`initialize failed: ${init.status} ${initText}`);
  }
  const initJson = parseBody(initText, init.headers.get("content-type"));
  if (initJson.result?.serverInfo?.name !== SERVER_NAME) {
    throw new Error(`unexpected server name: ${JSON.stringify(initJson)}`);
  }

  const list = await handler.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    }),
  );

  const listText = await list.text();
  if (!list.ok) {
    throw new Error(`tools/list failed: ${list.status} ${listText}`);
  }

  const listJson = parseBody(listText, list.headers.get("content-type"));
  const names = new Set((listJson.result?.tools ?? []).map((t: { name: string }) => t.name));
  const missing = EXPECTED_TOOL_NAMES.filter((n) => !names.has(n));
  if (missing.length) {
    throw new Error(`missing tools: ${missing.join(", ")}`);
  }

  await handler.close();
  console.log(`MCP smoke OK — ${SERVER_NAME}@${SERVER_VERSION}, tools=${names.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
