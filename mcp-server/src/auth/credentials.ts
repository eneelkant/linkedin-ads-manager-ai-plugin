import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { maskToken } from "../utils/redact.js";

export interface LinkedInCredentials {
  campaignsToken: string;
  accountId: string;
  postsToken?: string;
}

export interface CredentialStatus {
  campaignsConfigured: boolean;
  accountConfigured: boolean;
  postsConfigured: boolean;
  campaignsTokenPreview: string;
  accountId: string | null;
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function findEnvFile(): string | undefined {
  const candidates = [
    process.env.LINKEDIN_ENV_FILE,
    process.env.DOTENV_CONFIG_PATH,
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Load credentials from environment variables and optional local .env.
 * Never throws when optional posts token is missing.
 */
export function loadCredentialEnvironment(): void {
  const envPath = findEnvFile();
  if (envPath) {
    loadDotenv({ path: envPath, override: false });
  } else {
    loadDotenv({ override: false });
  }
}

export function readCredentialStatus(): CredentialStatus {
  loadCredentialEnvironment();
  const campaignsToken = process.env.LINKEDIN_CAMPAIGNS_TOKEN?.trim() ?? "";
  const accountId = process.env.LINKEDIN_ACCOUNT_ID?.trim() ?? "";
  const postsToken = process.env.LINKEDIN_POSTS_TOKEN?.trim() ?? "";

  return {
    campaignsConfigured: Boolean(campaignsToken),
    accountConfigured: Boolean(accountId),
    postsConfigured: Boolean(postsToken),
    campaignsTokenPreview: maskToken(campaignsToken || undefined),
    accountId: accountId || null,
  };
}

export function requireCampaignCredentials(): LinkedInCredentials {
  loadCredentialEnvironment();
  const campaignsToken = process.env.LINKEDIN_CAMPAIGNS_TOKEN?.trim();
  const accountId = process.env.LINKEDIN_ACCOUNT_ID?.trim();
  const postsToken = process.env.LINKEDIN_POSTS_TOKEN?.trim();

  if (!campaignsToken) {
    throw new CredentialError(
      "LINKEDIN_CAMPAIGNS_TOKEN is not configured. Set it in the environment or local .env file (see /linkedin-setup or docs/authentication.md).",
    );
  }
  if (!accountId) {
    throw new CredentialError(
      "LINKEDIN_ACCOUNT_ID is not configured. Set it in the environment or local .env file.",
    );
  }
  if (!/^\d+$/.test(accountId)) {
    throw new CredentialError(
      "LINKEDIN_ACCOUNT_ID must be a numeric LinkedIn ad account ID.",
    );
  }

  return {
    campaignsToken,
    accountId,
    postsToken: postsToken || undefined,
  };
}

export function requirePostsCredentials(): LinkedInCredentials {
  const creds = requireCampaignCredentials();
  if (!creds.postsToken) {
    throw new CredentialError(
      "LINKEDIN_POSTS_TOKEN is not configured. Organization posting requires a Community Management API token with w_organization_social. Campaign management does not require this token.",
    );
  }
  return creds;
}

export function isTrustedExecutionEnabled(): boolean {
  const value = (process.env.LINKEDIN_TRUSTED_EXECUTION ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export class CredentialError extends Error {
  readonly code = "CREDENTIAL_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}

/** Test helper — does not touch process env files beyond provided map. */
export function credentialsFromMap(map: Record<string, string>): LinkedInCredentials {
  const campaignsToken = map.LINKEDIN_CAMPAIGNS_TOKEN?.trim();
  const accountId = map.LINKEDIN_ACCOUNT_ID?.trim();
  if (!campaignsToken || !accountId) {
    throw new CredentialError("Missing required LinkedIn campaign credentials.");
  }
  return {
    campaignsToken,
    accountId,
    postsToken: map.LINKEDIN_POSTS_TOKEN?.trim() || undefined,
  };
}

export function peekEnvFileKeys(path: string): string[] {
  return Object.keys(parseEnvFile(path));
}
