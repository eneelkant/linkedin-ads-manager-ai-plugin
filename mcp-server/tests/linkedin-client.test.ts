import { describe, expect, it, vi } from "vitest";
import { LinkedInAdsClient } from "../src/linkedin/client.js";
import { LinkedInApiError, LinkedInTimeoutError, LinkedInValidationError } from "../src/linkedin/errors.js";

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    return handler(url, init);
  }) as unknown as typeof fetch;
}

const creds = {
  campaignsToken: "campaigns-token-abcdefghijklmnopqrstuvwxyz",
  accountId: "123456",
  postsToken: "posts-token-abcdefghijklmnopqrstuvwxyz",
};

describe("LinkedInAdsClient", () => {
  it("rejects invalid campaign ids", async () => {
    const client = new LinkedInAdsClient({
      credentials: creds,
      fetchImpl: mockFetch(() => new Response("{}", { status: 200 })),
    });
    await expect(client.getCampaign("abc")).rejects.toBeInstanceOf(LinkedInValidationError);
  });

  it("maps LinkedIn API errors and redacts bodies", async () => {
    const client = new LinkedInAdsClient({
      credentials: creds,
      fetchImpl: mockFetch(
        () =>
          new Response("Bearer campaigns-token-abcdefghijklmnopqrstuvwxyz failed", {
            status: 401,
          }),
      ),
    });
    await expect(client.getCampaign("1")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(LinkedInApiError);
      expect((err as LinkedInApiError).message).toContain("[REDACTED]");
      expect((err as LinkedInApiError).message).not.toContain(creds.campaignsToken);
      return true;
    });
  });

  it("maps rate limits", async () => {
    const client = new LinkedInAdsClient({
      credentials: creds,
      fetchImpl: mockFetch(
        () =>
          new Response("slow down", {
            status: 429,
            headers: { "retry-after": "12" },
          }),
      ),
    });
    await expect(client.listCampaigns()).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
    });
  });

  it("times out", async () => {
    const client = new LinkedInAdsClient({
      credentials: creds,
      timeoutMs: 10,
      fetchImpl: mockFetch(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(new Response("{}")), 100);
          }),
      ),
    });
    await expect(client.getAdAccount()).rejects.toBeInstanceOf(LinkedInTimeoutError);
  });

  it("creates campaigns as draft by default and reads restli id", async () => {
    const fetchImpl = mockFetch((url, init) => {
      expect(url).toContain("/adAccounts/123456/adCampaigns");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.status).toBe("DRAFT");
      expect(body.politicalIntent).toBe("NOT_DECLARED");
      return new Response("", {
        status: 201,
        headers: { "x-restli-id": "555" },
      });
    });
    const client = new LinkedInAdsClient({ credentials: creds, fetchImpl });
    const created = await client.createCampaign({
      name: "Test",
      campaignGroup: "urn:li:sponsoredCampaignGroup:1",
      type: "SPONSORED_UPDATES",
      costType: "CPM",
      locale: { country: "US", language: "en" },
    });
    expect(String(created.id)).toBe("555");
  });

  it("requires posts token for organization endpoints", async () => {
    const client = new LinkedInAdsClient({
      credentials: { campaignsToken: creds.campaignsToken, accountId: creds.accountId },
      fetchImpl: mockFetch(() => new Response("{}", { status: 200 })),
    });
    await expect(client.getOrganization("1")).rejects.toThrow(/POSTS_TOKEN/);
  });
});
