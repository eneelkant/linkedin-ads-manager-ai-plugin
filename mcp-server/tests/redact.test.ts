import { describe, expect, it } from "vitest";
import { maskToken, redactSecrets, sanitizeForOutput } from "../src/utils/redact.js";

describe("token redaction", () => {
  it("redacts bearer tokens", () => {
    const raw = "Authorization: Bearer token-value-abcdefghijklmnop.secret.token";
    expect(redactSecrets(raw)).toContain("[REDACTED]");
    expect(redactSecrets(raw)).not.toContain("token-value-abcdefghijklmnop");
  });

  it("masks tokens for display", () => {
    expect(maskToken("1234567890ABCDEF")).toBe("1234567890...");
    expect(maskToken(undefined)).toBe("(not set)");
  });

  it("sanitizes nested objects", () => {
    const sanitized = sanitizeForOutput({
      authorization: "Bearer token-value-supersecret123456",
      nested: { access_token: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" },
      ok: true,
    });
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.access_token).toBe("[REDACTED]");
    expect(sanitized.ok).toBe(true);
  });
});
