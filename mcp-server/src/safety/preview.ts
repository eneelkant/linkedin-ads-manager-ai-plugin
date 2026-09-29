export interface ActionPreview {
  requiresConfirmation: true;
  tool: string;
  account: string | null;
  campaign?: {
    id?: string;
    name?: string;
  };
  currentState: Record<string, unknown>;
  requestedState: Record<string, unknown>;
  budgetChange?: {
    from?: unknown;
    to?: unknown;
  };
  targetingChange?: {
    from?: unknown;
    to?: unknown;
  };
  expectedImpact: string;
  financialImplications: string;
  irreversible: boolean;
  message: string;
}

export function buildActionPreview(input: {
  tool: string;
  accountId: string | null;
  campaignId?: string;
  campaignName?: string;
  currentState: Record<string, unknown>;
  requestedState: Record<string, unknown>;
  budgetChange?: { from?: unknown; to?: unknown };
  targetingChange?: { from?: unknown; to?: unknown };
  expectedImpact: string;
  financialImplications: string;
  irreversible?: boolean;
}): ActionPreview {
  return {
    requiresConfirmation: true,
    tool: input.tool,
    account: input.accountId,
    campaign:
      input.campaignId || input.campaignName
        ? { id: input.campaignId, name: input.campaignName }
        : undefined,
    currentState: input.currentState,
    requestedState: input.requestedState,
    budgetChange: input.budgetChange,
    targetingChange: input.targetingChange,
    expectedImpact: input.expectedImpact,
    financialImplications: input.financialImplications,
    irreversible: input.irreversible ?? false,
    message:
      "Confirmation required. Re-invoke this tool with the same parameters and confirm=true to execute. No money will be spent until confirmed.",
  };
}
