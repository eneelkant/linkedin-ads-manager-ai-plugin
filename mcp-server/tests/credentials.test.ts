import { afterEach, describe, expect, it } from "vitest";
import {
  CredentialError,
  requireCampaignCredentials,
  requirePostsCredentials,
} from "../src/auth/credentials.js";

const KEYS = [
  "LINKEDIN_CAMPAIGNS_TOKEN",
  "LINKEDIN_ACCOUNT_ID",
  "LINKEDIN_POSTS_TOKEN",
] as const;

describe("credentials", () => {
  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  it("fails when campaigns token is missing", () => {
    process.env.LINKEDIN_ACCOUNT_ID = "123";
    expect(() => requireCampaignCredentials()).toThrow(CredentialError);
  });

  it("fails on invalid account id", () => {
    process.env.LINKEDIN_CAMPAIGNS_TOKEN = "token-value-1234567890";
    process.env.LINKEDIN_ACCOUNT_ID = "not-a-number";
    expect(() => requireCampaignCredentials()).toThrow(/numeric/i);
  });

  it("loads campaign credentials", () => {
    process.env.LINKEDIN_CAMPAIGNS_TOKEN = "token-value-1234567890";
    process.env.LINKEDIN_ACCOUNT_ID = "999888";
    const creds = requireCampaignCredentials();
    expect(creds.accountId).toBe("999888");
    expect(creds.campaignsToken).toBe("token-value-1234567890");
  });

  it("requires posts token for organization posting", () => {
    process.env.LINKEDIN_CAMPAIGNS_TOKEN = "token-value-1234567890";
    process.env.LINKEDIN_ACCOUNT_ID = "999888";
    expect(() => requirePostsCredentials()).toThrow(/LINKEDIN_POSTS_TOKEN/);
  });
});
