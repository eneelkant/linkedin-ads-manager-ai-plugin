import { isTrustedExecutionEnabled } from "../auth/credentials.js";

export type RiskLevel = "read" | "write" | "high_risk";

export const HIGH_RISK_TOOLS = new Set([
  "linkedin_create_campaign",
  "linkedin_clone_campaign",
  "linkedin_pause_campaign",
  "linkedin_resume_campaign",
  "linkedin_update_campaign_budget",
  "linkedin_update_campaign_targeting",
  "linkedin_create_organization_post",
]);

export const WRITE_TOOLS = new Set([
  ...HIGH_RISK_TOOLS,
  "linkedin_update_campaign",
  "linkedin_create_campaign_group",
  "linkedin_update_campaign_group",
  "linkedin_create_creative",
  "linkedin_update_creative",
  "linkedin_update_organization_post",
]);

export function riskLevelForTool(toolName: string): RiskLevel {
  if (HIGH_RISK_TOOLS.has(toolName)) return "high_risk";
  if (WRITE_TOOLS.has(toolName)) return "write";
  return "read";
}

export interface ConfirmationGateResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
}

/**
 * Safety gate for LinkedIn Ads mutations.
 * - Reads: always allowed
 * - Writes: require confirm=true unless LINKEDIN_TRUSTED_EXECUTION is enabled
 * - High-risk (money/launch/post): always require confirm=true
 */
export function evaluateConfirmation(
  toolName: string,
  confirm: boolean | undefined,
): ConfirmationGateResult {
  const risk = riskLevelForTool(toolName);
  if (risk === "read") {
    return { allowed: true, requiresConfirmation: false };
  }

  if (risk === "high_risk") {
    if (confirm === true) {
      return { allowed: true, requiresConfirmation: true };
    }
    return {
      allowed: false,
      requiresConfirmation: true,
      reason:
        "High-risk LinkedIn Ads action requires explicit confirmation. Review the preview, then call again with confirm=true. This server never silently spends money or launches campaigns.",
    };
  }

  // write
  if (confirm === true || isTrustedExecutionEnabled()) {
    return { allowed: true, requiresConfirmation: !isTrustedExecutionEnabled() };
  }
  return {
    allowed: false,
    requiresConfirmation: true,
    reason:
      "Write operation requires explicit confirmation (confirm=true), or configure LINKEDIN_TRUSTED_EXECUTION=true for trusted clients.",
  };
}
