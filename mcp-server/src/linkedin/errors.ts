import { redactSecrets } from "../utils/redact.js";

export class LinkedInApiError extends Error {
  readonly code = "LINKEDIN_API_ERROR";
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(redactSecrets(message));
    this.name = "LinkedInApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LinkedInValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "LinkedInValidationError";
  }
}

export class LinkedInTimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(message = "LinkedIn API request timed out") {
    super(message);
    this.name = "LinkedInTimeoutError";
  }
}

export function formatToolError(error: unknown): string {
  if (error instanceof LinkedInApiError) {
    const retry =
      error.retryAfterSeconds != null
        ? ` Retry after ${error.retryAfterSeconds}s.`
        : "";
    return `LinkedIn API error (${error.status}): ${error.message}.${retry}`;
  }
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return "Unknown error";
}
