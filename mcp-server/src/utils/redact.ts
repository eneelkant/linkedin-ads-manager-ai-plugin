const BEARER = /Bearer\s+[A-Za-z0-9._\-+/=]+/gi;
const ENV_TOKEN = /(LINKEDIN_(?:CAMPAIGNS|POSTS)_TOKEN\s*[=:]\s*)[^\s"']+/gi;
const JSON_SECRET =
  /("?(?:access_token|refresh_token|client_secret|authorization)"?\s*[:=]\s*"?)[^"'\s,}]+/gi;
const LONG_SECRET = /\b[A-Za-z0-9_-]{32,}\b/g;

export function redactSecrets(value: string): string {
  return value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(ENV_TOKEN, "$1[REDACTED]")
    .replace(JSON_SECRET, "$1[REDACTED]")
    .replace(LONG_SECRET, "[REDACTED]");
}

export function maskToken(token: string | undefined | null): string {
  if (!token) return "(not set)";
  if (token.length <= 10) return "[REDACTED]";
  return `${token.slice(0, 10)}...`;
}

export function sanitizeForOutput<T>(value: T): T {
  if (typeof value === "string") {
    return redactSecrets(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForOutput(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("secret") ||
        lower === "authorization" ||
        lower.includes("password")
      ) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeForOutput(nested);
      }
    }
    return out as T;
  }
  return value;
}
