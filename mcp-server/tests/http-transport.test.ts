import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHttpServer } from "../src/transport/http.js";
import { parseMcpResponseBody } from "./helpers/mcpRpc.js";

describe("Streamable HTTP transport", () => {
  let close: (() => Promise<void>) | undefined;
  const port = 3457;

  beforeAll(async () => {
    process.env.ALLOWED_HOSTS = "localhost,127.0.0.1";
    process.env.MCP_HTTP_HANDLE_SIGNALS = "0";
    delete process.env.MCP_HTTP_BEARER_TOKEN;
    const started = await startHttpServer(port);
    close = started.close;
  });

  afterAll(async () => {
    await close?.();
  });

  it("serves /health", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; transport: string };
    expect(body.status).toBe("ok");
    expect(body.transport).toBe("streamable-http");
  });

  it("accepts MCP initialize on /mcp", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        host: "127.0.0.1",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "http-test", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBeLessThan(500);
    const text = await res.text();
    const json = parseMcpResponseBody(text, res.headers.get("content-type"));
    expect(json.result?.serverInfo?.name ?? json.error).toBeTruthy();
  });
});
