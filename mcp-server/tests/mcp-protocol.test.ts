import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { createLinkedInMcpServer } from "../src/server.js";
import { EXPECTED_TOOL_NAMES } from "../src/tools/register.js";
import { mcpRpc } from "./helpers/mcpRpc.js";

describe("MCP protocol", () => {
  afterEach(() => {
    delete process.env.LINKEDIN_CAMPAIGNS_TOKEN;
    delete process.env.LINKEDIN_ACCOUNT_ID;
  });

  it("initializes and lists every expected tool with schemas", async () => {
    const handler = createMcpHandler(() => createLinkedInMcpServer(), {
      responseMode: "json",
    });

    const init = await mcpRpc(handler, {
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    expect(init.result.serverInfo.name).toBe("linkedin-ads-manager");

    const listed = await mcpRpc(
      handler,
      {
        method: "tools/list",
        params: {},
      },
      2,
    );

    const tools = listed.result.tools as Array<{
      name: string;
      description?: string;
      inputSchema?: unknown;
    }>;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOL_NAMES].sort());
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeTruthy();
    }

    await handler.close();
  });

  it("returns confirmation preview for budget updates without confirm", async () => {
    process.env.LINKEDIN_CAMPAIGNS_TOKEN = "token-value-1234567890";
    process.env.LINKEDIN_ACCOUNT_ID = "123456";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/adCampaigns/99")) {
        return new Response(
          JSON.stringify({
            id: 99,
            name: "Demo",
            status: "ACTIVE",
            dailyBudget: { amount: "25", currencyCode: "USD" },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    const handler = createMcpHandler(() => createLinkedInMcpServer(), {
      responseMode: "json",
    });
    await mcpRpc(handler, {
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });

    const call = await mcpRpc(
      handler,
      {
        method: "tools/call",
        params: {
          name: "linkedin_update_campaign_budget",
          arguments: {
            campaignId: "99",
            dailyBudgetAmount: "100",
          },
        },
      },
      3,
    );

    const text = call.result.content[0].text as string;
    expect(text).toContain("confirmationRequired");
    expect(text).toContain("financialImplications");
    expect(text).not.toContain("token-value-1234567890");

    globalThis.fetch = originalFetch;
    await handler.close();
  });
});
