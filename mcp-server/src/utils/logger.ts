type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

function serialize(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [unserializable-meta]";
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("debug")) return;
    console.error(`[debug] ${message}${serialize(meta)}`);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("info")) return;
    console.error(`[info] ${message}${serialize(meta)}`);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("warn")) return;
    console.error(`[warn] ${message}${serialize(meta)}`);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;
    console.error(`[error] ${message}${serialize(meta)}`);
  },
};
