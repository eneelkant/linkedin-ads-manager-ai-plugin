export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;
    const prior = this.hits.get(key) ?? [];
    const recent = prior.filter((ts) => ts > windowStart);
    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      const resetMs = (recent[0] ?? now) + this.windowMs - now;
      return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: Math.max(this.maxRequests - recent.length, 0),
      resetMs: this.windowMs,
    };
  }

  reset(): void {
    this.hits.clear();
  }
}

export function createDefaultRateLimiter(): MemoryRateLimiter {
  const max = Number(process.env.MCP_RATE_LIMIT_MAX ?? 120);
  const windowMs = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS ?? 60_000);
  return new MemoryRateLimiter(max, windowMs);
}
