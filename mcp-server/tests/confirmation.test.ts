import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateConfirmation,
  HIGH_RISK_TOOLS,
  riskLevelForTool,
} from "../src/safety/confirmation.js";

describe("confirmation safety gate", () => {
  afterEach(() => {
    delete process.env.LINKEDIN_TRUSTED_EXECUTION;
  });

  it("allows reads without confirmation", () => {
    expect(evaluateConfirmation("linkedin_list_campaigns", undefined).allowed).toBe(true);
  });

  it("blocks high-risk tools without confirm even when trusted execution is on", () => {
    process.env.LINKEDIN_TRUSTED_EXECUTION = "true";
    for (const tool of HIGH_RISK_TOOLS) {
      const result = evaluateConfirmation(tool, undefined);
      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
    }
  });

  it("allows high-risk tools with confirm=true", () => {
    expect(evaluateConfirmation("linkedin_update_campaign_budget", true).allowed).toBe(true);
  });

  it("allows ordinary writes when trusted execution is enabled", () => {
    process.env.LINKEDIN_TRUSTED_EXECUTION = "true";
    expect(riskLevelForTool("linkedin_update_campaign")).toBe("write");
    expect(evaluateConfirmation("linkedin_update_campaign", undefined).allowed).toBe(true);
  });

  it("blocks ordinary writes without confirm when trusted execution is off", () => {
    expect(evaluateConfirmation("linkedin_create_creative", undefined).allowed).toBe(false);
  });
});
