import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { requirePostsCredentials } from "../auth/credentials.js";
import {
  accountPreviewBase,
  buildActionPreview,
  errorResult,
  gateWrite,
  jsonResult,
  withClient,
} from "./helpers.js";

const confirmSchema = z
  .boolean()
  .optional()
  .describe(
    "Must be true to execute write/high-risk actions after reviewing the preview. Never set automatically for spend or launch operations.",
  );

function dateDaysSchema() {
  return z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Lookback window in days (default 30)");
}

export function registerLinkedInTools(server: McpServer): void {
  // ── ACCOUNT ──────────────────────────────────────────────
  server.registerTool(
    "linkedin_get_ad_account",
    {
      title: "Get LinkedIn Ad Account",
      description: "Retrieve details for the configured LinkedIn ad account (or a specific account ID).",
      inputSchema: z.object({
        accountId: z.string().optional().describe("Optional numeric ad account ID override"),
      }),
    },
    async ({ accountId }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, account: await client.getAdAccount(accountId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_list_ad_accounts",
    {
      title: "List LinkedIn Ad Accounts",
      description: "List accessible LinkedIn ad accounts for the configured credentials.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, accounts: await client.listAdAccounts() }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── CAMPAIGNS ────────────────────────────────────────────
  server.registerTool(
    "linkedin_list_campaigns",
    {
      title: "List LinkedIn Campaigns",
      description: "List campaigns in the configured ad account with optional filters.",
      inputSchema: z.object({
        nameContains: z.string().optional(),
        status: z.array(z.enum(["ACTIVE", "PAUSED", "DRAFT", "ARCHIVED", "CANCELED"])).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) =>
          jsonResult({
            ok: true,
            accountId: client.accountId,
            campaigns: await client.listCampaigns(input),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_campaign",
    {
      title: "Get LinkedIn Campaign",
      description: "Get full configuration for a single campaign.",
      inputSchema: z.object({
        campaignId: z.string().describe("Numeric campaign ID or sponsoredCampaign URN"),
      }),
    },
    async ({ campaignId }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, campaign: await client.getCampaign(campaignId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_create_campaign",
    {
      title: "Create LinkedIn Campaign",
      description:
        "Create a LinkedIn campaign. Defaults to DRAFT status. High-risk: requires confirm=true after preview.",
      inputSchema: z.object({
        name: z.string().min(1),
        campaignGroupId: z.string().describe("Numeric campaign group ID"),
        type: z.string().default("SPONSORED_UPDATES"),
        costType: z.string().default("CPM"),
        dailyBudgetAmount: z.string().optional().describe("Daily budget amount as string, e.g. \"50\""),
        currencyCode: z.string().default("USD"),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
        objectiveType: z.string().optional(),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const payload: Record<string, unknown> = {
            name: input.name,
            campaignGroup: `urn:li:sponsoredCampaignGroup:${input.campaignGroupId}`,
            type: input.type,
            costType: input.costType,
            status: input.status,
            locale: { country: "US", language: "en" },
            politicalIntent: "NOT_DECLARED",
          };
          if (input.objectiveType) payload.objectiveType = input.objectiveType;
          if (input.dailyBudgetAmount) {
            payload.dailyBudget = {
              amount: input.dailyBudgetAmount,
              currencyCode: input.currencyCode,
            };
          }

          return gateWrite({
            tool: "linkedin_create_campaign",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_create_campaign"),
                currentState: { exists: false },
                requestedState: payload,
                budgetChange: input.dailyBudgetAmount
                  ? { from: null, to: payload.dailyBudget }
                  : undefined,
                expectedImpact:
                  input.status === "ACTIVE"
                    ? "Creates and may begin spending if ACTIVE with creatives."
                    : "Creates a DRAFT/PAUSED campaign that will not spend until activated.",
                financialImplications:
                  input.status === "ACTIVE" && input.dailyBudgetAmount
                    ? `May spend up to ${input.currencyCode} ${input.dailyBudgetAmount}/day once live.`
                    : "No spend while campaign remains DRAFT/PAUSED.",
                irreversible: false,
              }),
            execute: () => client.createCampaign(payload),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_clone_campaign",
    {
      title: "Clone LinkedIn Campaign",
      description:
        "Clone an existing campaign into a new DRAFT campaign. High-risk: requires confirm=true.",
      inputSchema: z.object({
        sourceCampaignId: z.string(),
        name: z.string().min(1),
        dailyBudgetAmount: z.string().optional(),
        currencyCode: z.string().default("USD"),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const source = await client.getCampaign(input.sourceCampaignId);
          const modifications: Record<string, unknown> = { status: input.status };
          if (input.dailyBudgetAmount) {
            modifications.dailyBudget = {
              amount: input.dailyBudgetAmount,
              currencyCode: input.currencyCode,
            };
          }
          return gateWrite({
            tool: "linkedin_clone_campaign",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_clone_campaign"),
                campaignId: String(source.id),
                campaignName: source.name,
                currentState: {
                  sourceId: source.id,
                  sourceName: source.name,
                  sourceStatus: source.status,
                  sourceBudget: source.dailyBudget ?? source.totalBudget ?? null,
                },
                requestedState: {
                  name: input.name,
                  status: input.status,
                  modifications,
                },
                budgetChange: {
                  from: source.dailyBudget ?? null,
                  to: modifications.dailyBudget ?? source.dailyBudget ?? null,
                },
                expectedImpact: "Creates a new campaign cloned from the source.",
                financialImplications:
                  input.status === "ACTIVE"
                    ? "Clone would be ACTIVE and may spend once creatives are attached."
                    : "Clone defaults to non-spending status until activated.",
              }),
            execute: () =>
              client.cloneCampaign(input.sourceCampaignId, input.name, modifications),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_campaign",
    {
      title: "Update LinkedIn Campaign",
      description: "Update non-budget campaign fields. Requires confirm=true unless trusted execution is enabled.",
      inputSchema: z.object({
        campaignId: z.string(),
        name: z.string().optional(),
        status: z.enum(["ACTIVE", "PAUSED", "DRAFT", "ARCHIVED"]).optional(),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaign(input.campaignId);
          const updates: Record<string, unknown> = {};
          if (input.name) updates.name = input.name;
          if (input.status) updates.status = input.status;
          if (!Object.keys(updates).length) {
            return jsonResult({ ok: false, error: "No updates provided." }, true);
          }
          // Status transitions that spend money are high-risk — route through dedicated tools.
          if (input.status === "ACTIVE" || input.status === "PAUSED") {
            return jsonResult(
              {
                ok: false,
                error:
                  "Use linkedin_pause_campaign or linkedin_resume_campaign for status changes that affect spend.",
              },
              true,
            );
          }
          return gateWrite({
            tool: "linkedin_update_campaign",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_campaign"),
                campaignId: String(current.id),
                campaignName: current.name,
                currentState: { name: current.name, status: current.status },
                requestedState: updates,
                expectedImpact: "Updates campaign metadata.",
                financialImplications: "No direct budget change.",
              }),
            execute: () => client.updateCampaign(input.campaignId, updates),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_pause_campaign",
    {
      title: "Pause LinkedIn Campaign",
      description: "Pause a campaign. High-risk: requires confirm=true.",
      inputSchema: z.object({
        campaignId: z.string(),
        confirm: confirmSchema,
      }),
    },
    async ({ campaignId, confirm }) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaign(campaignId);
          return gateWrite({
            tool: "linkedin_pause_campaign",
            confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_pause_campaign"),
                campaignId: String(current.id),
                campaignName: current.name,
                currentState: { status: current.status, budget: current.dailyBudget ?? null },
                requestedState: { status: "PAUSED" },
                expectedImpact: "Stops delivery for this campaign.",
                financialImplications: "Spend stops after pause propagates.",
              }),
            execute: () => client.updateCampaign(campaignId, { status: "PAUSED" }),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_resume_campaign",
    {
      title: "Resume LinkedIn Campaign",
      description: "Set a campaign to ACTIVE. High-risk: requires confirm=true. May resume spend.",
      inputSchema: z.object({
        campaignId: z.string(),
        confirm: confirmSchema,
      }),
    },
    async ({ campaignId, confirm }) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaign(campaignId);
          return gateWrite({
            tool: "linkedin_resume_campaign",
            confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_resume_campaign"),
                campaignId: String(current.id),
                campaignName: current.name,
                currentState: { status: current.status, budget: current.dailyBudget ?? null },
                requestedState: { status: "ACTIVE" },
                expectedImpact: "Resumes delivery; spend may restart immediately.",
                financialImplications: current.dailyBudget
                  ? `May spend up to ${current.dailyBudget.currencyCode} ${current.dailyBudget.amount}/day.`
                  : "Campaign may spend according to its configured budget.",
              }),
            execute: () => client.updateCampaign(campaignId, { status: "ACTIVE" }),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── CAMPAIGN GROUPS ──────────────────────────────────────
  server.registerTool(
    "linkedin_list_campaign_groups",
    {
      title: "List Campaign Groups",
      description: "List campaign groups for the configured ad account.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional(),
      }),
    },
    async ({ limit }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, campaignGroups: await client.listCampaignGroups(limit) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_campaign_group",
    {
      title: "Get Campaign Group",
      description: "Get a single campaign group by ID.",
      inputSchema: z.object({ campaignGroupId: z.string() }),
    },
    async ({ campaignGroupId }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, campaignGroup: await client.getCampaignGroup(campaignGroupId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_create_campaign_group",
    {
      title: "Create Campaign Group",
      description: "Create a campaign group. Requires confirmation unless trusted execution is enabled.",
      inputSchema: z.object({
        name: z.string().min(1),
        status: z.enum(["ACTIVE", "PAUSED", "DRAFT"]).default("ACTIVE"),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) =>
          gateWrite({
            tool: "linkedin_create_campaign_group",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_create_campaign_group"),
                currentState: { exists: false },
                requestedState: { name: input.name, status: input.status },
                expectedImpact: "Creates a new campaign group container.",
                financialImplications: "No direct spend; campaigns inside the group control spend.",
              }),
            execute: () =>
              client.createCampaignGroup({ name: input.name, status: input.status }),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_campaign_group",
    {
      title: "Update Campaign Group",
      description: "Update a campaign group. Requires confirmation unless trusted execution is enabled.",
      inputSchema: z.object({
        campaignGroupId: z.string(),
        name: z.string().optional(),
        status: z.enum(["ACTIVE", "PAUSED", "DRAFT", "ARCHIVED"]).optional(),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaignGroup(input.campaignGroupId);
          const updates: Record<string, unknown> = {};
          if (input.name) updates.name = input.name;
          if (input.status) updates.status = input.status;
          return gateWrite({
            tool: "linkedin_update_campaign_group",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_campaign_group"),
                currentState: { name: current.name, status: current.status },
                requestedState: updates,
                expectedImpact: "Updates campaign group settings.",
                financialImplications: "May affect delivery of child campaigns if status changes.",
              }),
            execute: () => client.updateCampaignGroup(input.campaignGroupId, updates),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── CREATIVES ────────────────────────────────────────────
  server.registerTool(
    "linkedin_list_creatives",
    {
      title: "List Creatives",
      description: "List creatives, optionally filtered by campaign.",
      inputSchema: z.object({
        campaignId: z.string().optional(),
      }),
    },
    async ({ campaignId }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, creatives: await client.listCreatives(campaignId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_creative",
    {
      title: "Get Creative",
      description: "Get a creative by ID.",
      inputSchema: z.object({ creativeId: z.string() }),
    },
    async ({ creativeId }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({ ok: true, creative: await client.getCreative(creativeId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_create_creative",
    {
      title: "Create Creative",
      description: "Create a creative for a campaign. Requires confirmation unless trusted execution is enabled.",
      inputSchema: z.object({
        campaignId: z.string(),
        name: z.string().optional(),
        content: z.record(z.string(), z.unknown()).describe("Creative content payload per LinkedIn Ads API"),
        intendedStatus: z.enum(["ACTIVE", "PAUSED", "DRAFT"]).default("DRAFT"),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const payload = {
            campaign: `urn:li:sponsoredCampaign:${input.campaignId}`,
            name: input.name,
            content: input.content,
            intendedStatus: input.intendedStatus,
          };
          return gateWrite({
            tool: "linkedin_create_creative",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_create_creative"),
                campaignId: input.campaignId,
                currentState: { exists: false },
                requestedState: payload,
                expectedImpact: "Attaches a new creative to the campaign.",
                financialImplications: "May enable spend if campaign and creative become ACTIVE.",
              }),
            execute: () => client.createCreative(payload),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_creative",
    {
      title: "Update Creative",
      description: "Update a creative. Requires confirmation unless trusted execution is enabled.",
      inputSchema: z.object({
        creativeId: z.string(),
        intendedStatus: z.enum(["ACTIVE", "PAUSED", "DRAFT", "ARCHIVED"]).optional(),
        name: z.string().optional(),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCreative(input.creativeId);
          const updates: Record<string, unknown> = {};
          if (input.intendedStatus) updates.intendedStatus = input.intendedStatus;
          if (input.name) updates.name = input.name;
          return gateWrite({
            tool: "linkedin_update_creative",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_creative"),
                currentState: {
                  id: current.id,
                  name: current.name,
                  status: current.status ?? current.intendedStatus,
                },
                requestedState: updates,
                expectedImpact: "Updates creative configuration or status.",
                financialImplications: "Status changes may affect whether the parent campaign can spend.",
              }),
            execute: () => client.updateCreative(input.creativeId, updates),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── TARGETING / BUDGET ───────────────────────────────────
  server.registerTool(
    "linkedin_get_campaign_targeting",
    {
      title: "Get Campaign Targeting",
      description: "Return targetingCriteria for a campaign.",
      inputSchema: z.object({ campaignId: z.string() }),
    },
    async ({ campaignId }) => {
      try {
        return await withClient(async (client) => {
          const campaign = await client.getCampaign(campaignId);
          return jsonResult({
            ok: true,
            campaignId: String(campaign.id),
            name: campaign.name,
            targetingCriteria: campaign.targetingCriteria ?? {},
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_campaign_targeting",
    {
      title: "Update Campaign Targeting",
      description: "Replace targetingCriteria on a campaign. High-risk: requires confirm=true.",
      inputSchema: z.object({
        campaignId: z.string(),
        targetingCriteria: z.record(z.string(), z.unknown()),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaign(input.campaignId);
          return gateWrite({
            tool: "linkedin_update_campaign_targeting",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_campaign_targeting"),
                campaignId: String(current.id),
                campaignName: current.name,
                currentState: { targetingCriteria: current.targetingCriteria ?? {} },
                requestedState: { targetingCriteria: input.targetingCriteria },
                targetingChange: {
                  from: current.targetingCriteria ?? {},
                  to: input.targetingCriteria,
                },
                expectedImpact: "Changes who can see/receive the ads.",
                financialImplications:
                  "Audience changes can materially change spend efficiency and reach. No silent budget increase.",
              }),
            execute: () =>
              client.updateCampaign(input.campaignId, {
                targetingCriteria: input.targetingCriteria,
              }),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_campaign_budget",
    {
      title: "Get Campaign Budget",
      description: "Return daily/total budget fields for a campaign.",
      inputSchema: z.object({ campaignId: z.string() }),
    },
    async ({ campaignId }) => {
      try {
        return await withClient(async (client) => {
          const campaign = await client.getCampaign(campaignId);
          return jsonResult({
            ok: true,
            campaignId: String(campaign.id),
            name: campaign.name,
            dailyBudget: campaign.dailyBudget ?? null,
            totalBudget: campaign.totalBudget ?? null,
            unitCost: campaign.unitCost ?? null,
            status: campaign.status,
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_campaign_budget",
    {
      title: "Update Campaign Budget",
      description:
        "Update daily budget. High-risk: requires confirm=true. Never silently increases budget.",
      inputSchema: z.object({
        campaignId: z.string(),
        dailyBudgetAmount: z.string().describe("New daily budget amount as string"),
        currencyCode: z.string().default("USD"),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const current = await client.getCampaign(input.campaignId);
          const nextBudget = {
            amount: input.dailyBudgetAmount,
            currencyCode: input.currencyCode,
          };
          return gateWrite({
            tool: "linkedin_update_campaign_budget",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_campaign_budget"),
                campaignId: String(current.id),
                campaignName: current.name,
                currentState: { dailyBudget: current.dailyBudget ?? null, status: current.status },
                requestedState: { dailyBudget: nextBudget },
                budgetChange: { from: current.dailyBudget ?? null, to: nextBudget },
                expectedImpact: "Changes maximum daily spend for the campaign.",
                financialImplications: `Requested daily budget: ${input.currencyCode} ${input.dailyBudgetAmount}. This can increase real advertising spend.`,
              }),
            execute: () =>
              client.updateCampaign(input.campaignId, { dailyBudget: nextBudget }),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── REPORTING ────────────────────────────────────────────
  server.registerTool(
    "linkedin_get_campaign_analytics",
    {
      title: "Get Campaign Analytics",
      description: "Fetch campaign-level analytics for a date window.",
      inputSchema: z.object({
        campaignIds: z.array(z.string()).optional(),
        days: dateDaysSchema(),
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) =>
          jsonResult({
            ok: true,
            analytics: await client.getAnalytics({
              campaignIds: input.campaignIds,
              days: input.days,
              pivot: "CAMPAIGN",
            }),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_account_analytics",
    {
      title: "Get Account Analytics",
      description: "Fetch account-level analytics for a date window.",
      inputSchema: z.object({ days: dateDaysSchema() }),
    },
    async ({ days }) => {
      try {
        return await withClient(async (client) =>
          jsonResult({
            ok: true,
            analytics: await client.getAnalytics({ days, pivot: "ACCOUNT" }),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_spend",
    {
      title: "Get LinkedIn Ads Spend",
      description: "Summarize spend from analytics for campaigns or the account.",
      inputSchema: z.object({
        campaignIds: z.array(z.string()).optional(),
        days: dateDaysSchema(),
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const rows = await client.getAnalytics({
            campaignIds: input.campaignIds,
            days: input.days,
            pivot: "CAMPAIGN",
          });
          const byCampaign = rows.map((row) => {
            const spend = Number(row.costInUsd ?? 0);
            return {
              campaignUrn: row.pivotValues?.[0] ?? null,
              spendUsd: spend,
              impressions: row.impressions ?? 0,
              clicks: row.clicks ?? 0,
            };
          });
          const totalSpendUsd = byCampaign.reduce((sum, row) => sum + row.spendUsd, 0);
          return jsonResult({ ok: true, totalSpendUsd, byCampaign, days: input.days ?? 30 });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_leads",
    {
      title: "Get Lead Metrics",
      description:
        "Return lead-oriented conversion metrics from ad analytics (externalWebsiteConversions and related fields).",
      inputSchema: z.object({
        campaignIds: z.array(z.string()).optional(),
        days: dateDaysSchema(),
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const rows = await client.getAnalytics({
            campaignIds: input.campaignIds,
            days: input.days,
            pivot: "CAMPAIGN",
          });
          return jsonResult({
            ok: true,
            note: "Lead gen form export APIs vary by account; this tool returns conversion metrics available via adAnalytics.",
            leads: rows.map((row) => ({
              campaignUrn: row.pivotValues?.[0] ?? null,
              conversions: row.externalWebsiteConversions ?? 0,
              clicks: row.clicks ?? 0,
              spendUsd: Number(row.costInUsd ?? 0),
            })),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_get_conversions",
    {
      title: "Get Conversions",
      description: "Return conversion metrics from LinkedIn ad analytics.",
      inputSchema: z.object({
        campaignIds: z.array(z.string()).optional(),
        days: dateDaysSchema(),
      }),
    },
    async (input) => {
      try {
        return await withClient(async (client) => {
          const rows = await client.getAnalytics({
            campaignIds: input.campaignIds,
            days: input.days,
            pivot: "CAMPAIGN",
          });
          return jsonResult({
            ok: true,
            conversions: rows.map((row) => ({
              campaignUrn: row.pivotValues?.[0] ?? null,
              externalWebsiteConversions: row.externalWebsiteConversions ?? 0,
              landingPageClicks: row.landingPageClicks ?? 0,
              spendUsd: Number(row.costInUsd ?? 0),
            })),
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── AUDITING ─────────────────────────────────────────────
  server.registerTool(
    "linkedin_audit_account",
    {
      title: "Audit Ad Account",
      description: "Operational audit of active campaigns: missing creatives, spend, status.",
      inputSchema: z.object({
        days: dateDaysSchema(),
      }),
    },
    async ({ days }) => {
      try {
        return await withClient(async (client) => {
          const campaigns = await client.listCampaigns({ status: ["ACTIVE"] });
          const analytics = await client.getAnalytics({
            campaignIds: campaigns.map((c) => c.id),
            days: days ?? 30,
          });
          const spendById = new Map<string, number>();
          for (const row of analytics) {
            const id = row.pivotValues?.[0]?.split(":").pop();
            if (id) spendById.set(id, Number(row.costInUsd ?? 0));
          }
          const findings = [];
          for (const campaign of campaigns) {
            const id = String(campaign.id);
            const creatives = await client.listCreatives(id);
            const serving = creatives.filter((c) => c.isServing).length;
            const issues: string[] = [];
            if (!creatives.length) issues.push("No creatives");
            else if (!serving) issues.push("No serving creatives");
            if (!campaign.dailyBudget && !campaign.totalBudget) issues.push("No budget configured");
            findings.push({
              id,
              name: campaign.name,
              status: campaign.status,
              dailyBudget: campaign.dailyBudget ?? null,
              spendUsd: spendById.get(id) ?? 0,
              creativeCount: creatives.length,
              servingCreatives: serving,
              issues,
              recommendation: issues.length ? "REVIEW" : "OK",
            });
          }
          return jsonResult({
            ok: true,
            accountId: client.accountId,
            activeCampaigns: campaigns.length,
            findings,
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_audit_campaign",
    {
      title: "Audit Campaign",
      description: "Audit a single campaign for configuration and recent performance.",
      inputSchema: z.object({
        campaignId: z.string(),
        days: dateDaysSchema(),
      }),
    },
    async ({ campaignId, days }) => {
      try {
        return await withClient(async (client) => {
          const campaign = await client.getCampaign(campaignId);
          const creatives = await client.listCreatives(campaignId);
          const analytics = await client.getAnalytics({
            campaignIds: [campaignId],
            days: days ?? 30,
          });
          const issues: string[] = [];
          if (campaign.status === "ACTIVE" && !creatives.length) issues.push("ACTIVE without creatives");
          if (!campaign.targetingCriteria) issues.push("Missing targetingCriteria");
          if (!campaign.dailyBudget && !campaign.totalBudget) issues.push("Missing budget");
          return jsonResult({
            ok: true,
            campaign,
            creatives,
            analytics,
            issues,
            recommendation: issues.length ? "REVIEW" : "OK",
          });
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ── ORGANIZATION (optional) ──────────────────────────────
  server.registerTool(
    "linkedin_get_organization",
    {
      title: "Get Organization",
      description:
        "Get LinkedIn organization details. Only available when LINKEDIN_POSTS_TOKEN (Community Management) is configured.",
      inputSchema: z.object({ organizationId: z.string() }),
    },
    async ({ organizationId }) => {
      try {
        requirePostsCredentials();
        return await withClient(async (client) =>
          jsonResult({ ok: true, organization: await client.getOrganization(organizationId) }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_create_organization_post",
    {
      title: "Create Organization Post",
      description:
        "Publish a post to a LinkedIn organization. Requires Community Management token. High-risk: confirm=true required.",
      inputSchema: z.object({
        organizationId: z.string(),
        commentary: z.string().min(1).max(3000),
        visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        requirePostsCredentials();
        return await withClient(async (client) =>
          gateWrite({
            tool: "linkedin_create_organization_post",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_create_organization_post"),
                currentState: { published: false },
                requestedState: {
                  organizationId: input.organizationId,
                  commentary: input.commentary,
                  visibility: input.visibility,
                },
                expectedImpact: "Publishes content to the organization page feed.",
                financialImplications: "Not an ads spend action; content becomes public to the selected audience.",
                irreversible: true,
              }),
            execute: () =>
              client.createOrganizationPost({
                organizationId: input.organizationId,
                commentary: input.commentary,
                visibility: input.visibility,
              }),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "linkedin_update_organization_post",
    {
      title: "Update Organization Post",
      description:
        "Update an organization post. Requires Community Management token and confirmation unless trusted execution is enabled.",
      inputSchema: z.object({
        postId: z.string(),
        commentary: z.string().optional(),
        lifecycleState: z.enum(["PUBLISHED", "DRAFT"]).optional(),
        confirm: confirmSchema,
      }),
    },
    async (input) => {
      try {
        requirePostsCredentials();
        const updates: Record<string, unknown> = {};
        if (input.commentary) updates.commentary = input.commentary;
        if (input.lifecycleState) updates.lifecycleState = input.lifecycleState;
        return await withClient(async (client) =>
          gateWrite({
            tool: "linkedin_update_organization_post",
            confirm: input.confirm,
            buildPreview: () =>
              buildActionPreview({
                ...accountPreviewBase("linkedin_update_organization_post"),
                currentState: { postId: input.postId },
                requestedState: updates,
                expectedImpact: "Updates an existing organization post.",
                financialImplications: "Not an ads spend action.",
                irreversible: Boolean(input.lifecycleState === "PUBLISHED"),
              }),
            execute: () => client.updateOrganizationPost(input.postId, updates),
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

export const EXPECTED_TOOL_NAMES = [
  "linkedin_get_ad_account",
  "linkedin_list_ad_accounts",
  "linkedin_list_campaigns",
  "linkedin_get_campaign",
  "linkedin_create_campaign",
  "linkedin_clone_campaign",
  "linkedin_update_campaign",
  "linkedin_pause_campaign",
  "linkedin_resume_campaign",
  "linkedin_list_campaign_groups",
  "linkedin_get_campaign_group",
  "linkedin_create_campaign_group",
  "linkedin_update_campaign_group",
  "linkedin_list_creatives",
  "linkedin_get_creative",
  "linkedin_create_creative",
  "linkedin_update_creative",
  "linkedin_get_campaign_targeting",
  "linkedin_update_campaign_targeting",
  "linkedin_get_campaign_budget",
  "linkedin_update_campaign_budget",
  "linkedin_get_campaign_analytics",
  "linkedin_get_account_analytics",
  "linkedin_get_spend",
  "linkedin_get_leads",
  "linkedin_get_conversions",
  "linkedin_audit_account",
  "linkedin_audit_campaign",
  "linkedin_get_organization",
  "linkedin_create_organization_post",
  "linkedin_update_organization_post",
] as const;
