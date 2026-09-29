import { readCredentialStatus } from "../auth/credentials.js";
import { createLinkedInClient, type LinkedInAdsClient } from "../linkedin/client.js";
import { formatToolError } from "../linkedin/errors.js";
import { evaluateConfirmation } from "../safety/confirmation.js";
import { buildActionPreview, type ActionPreview } from "../safety/preview.js";
import { sanitizeForOutput } from "../utils/redact.js";

export type ToolContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function jsonResult(data: unknown, isError = false): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify(sanitizeForOutput(data), null, 2) }],
    isError,
  };
}

export function errorResult(error: unknown): ToolContent {
  return jsonResult(
    {
      ok: false,
      error: formatToolError(error),
    },
    true,
  );
}

export function withClient<T>(
  fn: (client: LinkedInAdsClient) => Promise<T>,
): Promise<T> {
  const client = createLinkedInClient();
  return fn(client);
}

export async function gateWrite(options: {
  tool: string;
  confirm?: boolean;
  buildPreview: () => Promise<ActionPreview> | ActionPreview;
  execute: () => Promise<unknown>;
}): Promise<ToolContent> {
  const gate = evaluateConfirmation(options.tool, options.confirm);
  if (!gate.allowed) {
    const preview = await options.buildPreview();
    return jsonResult({
      ok: false,
      confirmationRequired: true,
      reason: gate.reason,
      preview,
    });
  }
  const result = await options.execute();
  return jsonResult({ ok: true, result: sanitizeForOutput(result) });
}

export function accountPreviewBase(tool: string) {
  const status = readCredentialStatus();
  return {
    tool,
    accountId: status.accountId,
  };
}

export { buildActionPreview, readCredentialStatus };
