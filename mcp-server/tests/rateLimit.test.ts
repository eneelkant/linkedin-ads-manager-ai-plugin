import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "../src/utils/rateLimit.js";

describe("rate limiter", () => {
  it("blocks after max requests", () => {
    const limiter = new MemoryRateLimiter(2, 1000);
    expect(limiter.check("a", 1).allowed).toBe(true);
    expect(limiter.check("a", 2).allowed).toBe(true);
    expect(limiter.check("a", 3).allowed).toBe(false);
  });
});
