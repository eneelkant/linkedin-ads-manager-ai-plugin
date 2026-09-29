import {
  requireCampaignCredentials,
  type LinkedInCredentials,
} from "../auth/credentials.js";
import { logger } from "../utils/logger.js";
import { redactSecrets } from "../utils/redact.js";
import {
  LinkedInApiError,
  LinkedInTimeoutError,
  LinkedInValidationError,
} from "./errors.js";
import type {
  AnalyticsRow,
  LinkedInAdAccount,
  LinkedInCampaign,
  LinkedInCampaignGroup,
  LinkedInCreative,
} from "./types.js";

const DEFAULT_VERSION = process.env.LINKEDIN_API_VERSION ?? "202601";
const DEFAULT_TIMEOUT_MS = Number(process.env.LINKEDIN_HTTP_TIMEOUT_MS ?? 30_000);

export type FetchLike = typeof fetch;

export interface LinkedInClientOptions {
  credentials?: LinkedInCredentials;
  fetchImpl?: FetchLike;
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  usePostsToken?: boolean;
}

function normalizeId(id: string | number, urnPrefix?: string): string {
  let value = String(id);
  if (urnPrefix && value.startsWith(urnPrefix)) {
    value = value.split(":").pop() ?? value;
  }
  return value;
}

function campaignId(id: string | number): string {
  return normalizeId(id, "urn:li:sponsoredCampaign:");
}

function encodeCampaignUrn(id: string | number): string {
  return encodeURIComponent(`urn:li:sponsoredCampaign:${campaignId(id)}`);
}

export class LinkedInAdsClient {
  private readonly credentials: LinkedInCredentials;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor(options: LinkedInClientOptions = {}) {
    this.credentials = options.credentials ?? requireCampaignCredentials();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.linkedin.com/rest";
    this.apiVersion = options.apiVersion ?? DEFAULT_VERSION;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get accountId(): string {
    return this.credentials.accountId;
  }

  get hasPostsToken(): boolean {
    return Boolean(this.credentials.postsToken);
  }

  private headers(opts: { partialUpdate?: boolean; usePostsToken?: boolean } = {}): Record<string, string> {
    const token = opts.usePostsToken
      ? this.credentials.postsToken
      : this.credentials.campaignsToken;
    if (!token) {
      throw new LinkedInValidationError(
        opts.usePostsToken
          ? "LINKEDIN_POSTS_TOKEN is required for organization posting."
          : "LINKEDIN_CAMPAIGNS_TOKEN is required.",
      );
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": this.apiVersion,
      "Content-Type": "application/json",
    };
    if (opts.partialUpdate) {
      headers["X-RestLi-Method"] = "PARTIAL_UPDATE";
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      partialUpdate?: boolean;
      usePostsToken?: boolean;
      allowEmpty?: boolean;
    } = {},
  ): Promise<{ data: T; headers: Headers; status: number }> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      logger.debug("linkedin.request", { method, path: redactSecrets(path) });
      const fetchPromise = this.fetchImpl(url, {
        method,
        headers: this.headers({
          partialUpdate: options.partialUpdate,
          usePostsToken: options.usePostsToken,
        }),
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new LinkedInTimeoutError());
        });
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

      if (response.status === 429) {
        throw new LinkedInApiError(
          429,
          "Rate limited by LinkedIn API",
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        );
      }

      if (!response.ok) {
        const text = await response.text();
        throw new LinkedInApiError(
          response.status,
          text || response.statusText,
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        );
      }

      if (response.status === 204 || options.allowEmpty) {
        const text = await response.text();
        if (!text) {
          return { data: {} as T, headers: response.headers, status: response.status };
        }
        return {
          data: JSON.parse(text) as T,
          headers: response.headers,
          status: response.status,
        };
      }

      const text = await response.text();
      if (!text) {
        return { data: {} as T, headers: response.headers, status: response.status };
      }
      return {
        data: JSON.parse(text) as T,
        headers: response.headers,
        status: response.status,
      };
    } catch (error) {
      if (
        error instanceof LinkedInTimeoutError ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error instanceof LinkedInTimeoutError ? error : new LinkedInTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async getAdAccount(accountId?: string): Promise<LinkedInAdAccount> {
    const id = accountId ? normalizeId(accountId) : this.accountId;
    if (!/^\d+$/.test(id)) {
      throw new LinkedInValidationError("Invalid account ID. Expected a numeric ad account ID.");
    }
    const { data } = await this.request<LinkedInAdAccount>("GET", `/adAccounts/${id}`);
    return data;
  }

  async listAdAccounts(): Promise<LinkedInAdAccount[]> {
    // Prefer the configured account; LinkedIn search of all accounts can be restricted.
    const account = await this.getAdAccount();
    return [account];
  }

  async listCampaigns(filters: {
    nameContains?: string;
    status?: string[];
    limit?: number;
  } = {}): Promise<LinkedInCampaign[]> {
    const all: LinkedInCampaign[] = [];
    let pageToken: string | undefined;

    do {
      let path = `/adAccounts/${this.accountId}/adCampaigns?q=search`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
      if (filters.status?.length) {
        path += `&search=(status:(values:List(${filters.status.join(",")})))`;
      }
      const { data } = await this.request<{
        elements?: LinkedInCampaign[];
        metadata?: { nextPageToken?: string };
      }>("GET", path);
      all.push(...(data.elements ?? []));
      pageToken = data.metadata?.nextPageToken;
    } while (pageToken);

    let result = all;
    if (filters.nameContains) {
      const needle = filters.nameContains.toLowerCase();
      result = result.filter((c) => (c.name ?? "").toLowerCase().includes(needle));
    }
    if (filters.limit != null) {
      result = result.slice(0, filters.limit);
    }
    return result;
  }

  async getCampaign(id: string | number): Promise<LinkedInCampaign> {
    const cid = campaignId(id);
    if (!/^\d+$/.test(cid)) {
      throw new LinkedInValidationError("Invalid campaign ID. Expected a numeric campaign ID or URN.");
    }
    const { data } = await this.request<LinkedInCampaign>(
      "GET",
      `/adAccounts/${this.accountId}/adCampaigns/${cid}`,
    );
    return data;
  }

  async createCampaign(campaignData: Record<string, unknown>): Promise<LinkedInCampaign> {
    const payload = {
      politicalIntent: "NOT_DECLARED",
      status: "DRAFT",
      ...campaignData,
      account: campaignData.account ?? `urn:li:sponsoredAccount:${this.accountId}`,
    };
    const { data, headers, status } = await this.request<LinkedInCampaign>(
      "POST",
      `/adAccounts/${this.accountId}/adCampaigns`,
      { body: payload, allowEmpty: true },
    );
    if (!data.id) {
      const restliId = headers.get("x-restli-id") ?? headers.get("location");
      return { ...data, id: restliId ?? "created", status: data.status ?? "DRAFT" };
    }
    logger.debug("linkedin.createCampaign", { status });
    return data;
  }

  async updateCampaign(
    id: string | number,
    updates: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const cid = campaignId(id);
    if (!/^\d+$/.test(cid)) {
      throw new LinkedInValidationError("Invalid campaign ID.");
    }
    const { data } = await this.request<Record<string, unknown>>(
      "POST",
      `/adAccounts/${this.accountId}/adCampaigns/${cid}`,
      {
        body: { patch: { $set: updates } },
        partialUpdate: true,
        allowEmpty: true,
      },
    );
    return Object.keys(data).length ? data : { status: "updated", id: cid };
  }

  async cloneCampaign(
    sourceId: string | number,
    newName: string,
    modifications: Record<string, unknown> = {},
  ): Promise<LinkedInCampaign> {
    const source = await this.getCampaign(sourceId);
    const cloned: Record<string, unknown> = {
      account: source.account,
      campaignGroup: source.campaignGroup,
      name: newName,
      type: source.type,
      costType: source.costType,
      locale: source.locale,
      status: "DRAFT",
      targetingCriteria: source.targetingCriteria,
      offsiteDeliveryEnabled: source.offsiteDeliveryEnabled ?? false,
    };

    for (const key of [
      "dailyBudget",
      "totalBudget",
      "unitCost",
      "objectiveType",
      "optimizationTargetType",
      "format",
      "runSchedule",
      "creativeSelection",
      "pacingStrategy",
      "politicalIntent",
      "audienceExpansionEnabled",
      "storyDeliveryEnabled",
    ] as const) {
      if (source[key] !== undefined) cloned[key] = source[key];
    }
    if (!cloned.politicalIntent) cloned.politicalIntent = "NOT_DECLARED";
    Object.assign(cloned, modifications);
    if (!modifications.status) cloned.status = "DRAFT";
    return this.createCampaign(cloned);
  }

  async listCampaignGroups(limit = 50): Promise<LinkedInCampaignGroup[]> {
    const { data } = await this.request<{ elements?: LinkedInCampaignGroup[] }>(
      "GET",
      `/adAccounts/${this.accountId}/adCampaignGroups?q=search`,
    );
    return (data.elements ?? []).slice(0, limit);
  }

  async getCampaignGroup(id: string | number): Promise<LinkedInCampaignGroup> {
    const gid = normalizeId(id, "urn:li:sponsoredCampaignGroup:");
    if (!/^\d+$/.test(gid)) {
      throw new LinkedInValidationError("Invalid campaign group ID.");
    }
    const { data } = await this.request<LinkedInCampaignGroup>(
      "GET",
      `/adAccounts/${this.accountId}/adCampaignGroups/${gid}`,
    );
    return data;
  }

  async createCampaignGroup(
    payload: Record<string, unknown>,
  ): Promise<LinkedInCampaignGroup> {
    const body = {
      status: "ACTIVE",
      ...payload,
      account: payload.account ?? `urn:li:sponsoredAccount:${this.accountId}`,
    };
    const { data, headers } = await this.request<LinkedInCampaignGroup>(
      "POST",
      `/adAccounts/${this.accountId}/adCampaignGroups`,
      { body, allowEmpty: true },
    );
    if (!data.id) {
      return {
        ...data,
        id: headers.get("x-restli-id") ?? "created",
        name: String(payload.name ?? "created"),
      };
    }
    return data;
  }

  async updateCampaignGroup(
    id: string | number,
    updates: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const gid = normalizeId(id, "urn:li:sponsoredCampaignGroup:");
    const { data } = await this.request<Record<string, unknown>>(
      "POST",
      `/adAccounts/${this.accountId}/adCampaignGroups/${gid}`,
      {
        body: { patch: { $set: updates } },
        partialUpdate: true,
        allowEmpty: true,
      },
    );
    return Object.keys(data).length ? data : { status: "updated", id: gid };
  }

  async listCreatives(campaignIdValue?: string | number): Promise<LinkedInCreative[]> {
    let path = `/adAccounts/${this.accountId}/creatives?q=criteria`;
    if (campaignIdValue != null) {
      path += `&campaigns=List(${encodeCampaignUrn(campaignIdValue)})`;
    }
    const { data } = await this.request<{ elements?: LinkedInCreative[] }>("GET", path);
    return data.elements ?? [];
  }

  async getCreative(id: string | number): Promise<LinkedInCreative> {
    const cid = normalizeId(id, "urn:li:sponsoredCreative:");
    if (!/^\d+$/.test(cid)) {
      throw new LinkedInValidationError("Invalid creative ID.");
    }
    const { data } = await this.request<LinkedInCreative>(
      "GET",
      `/adAccounts/${this.accountId}/creatives/${cid}`,
    );
    return data;
  }

  async createCreative(payload: Record<string, unknown>): Promise<LinkedInCreative> {
    const { data, headers } = await this.request<LinkedInCreative>(
      "POST",
      `/adAccounts/${this.accountId}/creatives`,
      { body: payload, allowEmpty: true },
    );
    if (!data.id) {
      return { ...data, id: headers.get("x-restli-id") ?? "created" };
    }
    return data;
  }

  async updateCreative(
    id: string | number,
    updates: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const cid = normalizeId(id, "urn:li:sponsoredCreative:");
    const { data } = await this.request<Record<string, unknown>>(
      "POST",
      `/adAccounts/${this.accountId}/creatives/${cid}`,
      {
        body: { patch: { $set: updates } },
        partialUpdate: true,
        allowEmpty: true,
      },
    );
    return Object.keys(data).length ? data : { status: "updated", id: cid };
  }

  async getAnalytics(options: {
    campaignIds?: Array<string | number>;
    days?: number;
    pivot?: "CAMPAIGN" | "ACCOUNT";
  }): Promise<AnalyticsRow[]> {
    const days = options.days ?? 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const dateRange = `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;
    const pivot = options.pivot ?? "CAMPAIGN";
    let path = `/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=ALL&${dateRange}&fields=impressions,clicks,costInUsd,externalWebsiteConversions,landingPageClicks,pivotValues`;

    if (pivot === "CAMPAIGN") {
      let ids = options.campaignIds;
      if (!ids?.length) {
        const campaigns = await this.listCampaigns({ status: ["ACTIVE"], limit: 50 });
        ids = campaigns.map((c) => c.id);
      }
      if (!ids.length) return [];
      const urns = ids.map((id) => encodeCampaignUrn(id)).join(",");
      path += `&campaigns=List(${urns})`;
    } else {
      path += `&accounts=List(${encodeURIComponent(`urn:li:sponsoredAccount:${this.accountId}`)})`;
    }

    const { data } = await this.request<{ elements?: AnalyticsRow[] }>("GET", path);
    return data.elements ?? [];
  }

  private ensurePostsToken(): void {
    if (!this.credentials.postsToken) {
      throw new LinkedInValidationError(
        "LINKEDIN_POSTS_TOKEN is not configured. Organization posting requires a Community Management API token with w_organization_social.",
      );
    }
  }

  async getOrganization(organizationId: string): Promise<Record<string, unknown>> {
    this.ensurePostsToken();
    const oid = normalizeId(organizationId, "urn:li:organization:");
    if (!/^\d+$/.test(oid)) {
      throw new LinkedInValidationError("Invalid organization ID.");
    }
    const { data } = await this.request<Record<string, unknown>>(
      "GET",
      `/organizations/${oid}`,
      { usePostsToken: true },
    );
    return data;
  }

  async createOrganizationPost(input: {
    organizationId: string;
    commentary: string;
    visibility?: "PUBLIC" | "CONNECTIONS";
  }): Promise<Record<string, unknown>> {
    this.ensurePostsToken();
    const oid = normalizeId(input.organizationId, "urn:li:organization:");
    const payload = {
      author: `urn:li:organization:${oid}`,
      commentary: input.commentary,
      visibility: input.visibility ?? "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    const { data, headers } = await this.request<Record<string, unknown>>("POST", "/posts", {
      body: payload,
      usePostsToken: true,
      allowEmpty: true,
    });
    const id = data.id ?? headers.get("x-restli-id");
    return { id, ...data };
  }

  async updateOrganizationPost(
    postId: string,
    updates: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.ensurePostsToken();
    const encoded = encodeURIComponent(postId);
    const { data } = await this.request<Record<string, unknown>>("POST", `/posts/${encoded}`, {
      body: { patch: { $set: updates } },
      partialUpdate: true,
      usePostsToken: true,
      allowEmpty: true,
    });
    return Object.keys(data).length ? data : { status: "updated", id: postId };
  }
}

export function createLinkedInClient(options?: LinkedInClientOptions): LinkedInAdsClient {
  return new LinkedInAdsClient(options);
}
