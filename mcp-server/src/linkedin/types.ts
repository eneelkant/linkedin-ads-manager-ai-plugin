export type CampaignStatus = "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED" | "CANCELED";

export interface MoneyAmount {
  amount: string;
  currencyCode: string;
}

export interface LinkedInCampaign {
  id: string | number;
  name: string;
  status: CampaignStatus | string;
  type?: string;
  account?: string;
  campaignGroup?: string;
  dailyBudget?: MoneyAmount;
  totalBudget?: MoneyAmount;
  unitCost?: MoneyAmount;
  targetingCriteria?: Record<string, unknown>;
  costType?: string;
  locale?: Record<string, unknown>;
  objectiveType?: string;
  optimizationTargetType?: string;
  format?: string;
  runSchedule?: Record<string, unknown>;
  creativeSelection?: string;
  pacingStrategy?: string;
  politicalIntent?: string;
  audienceExpansionEnabled?: boolean;
  storyDeliveryEnabled?: boolean;
  offsiteDeliveryEnabled?: boolean;
  [key: string]: unknown;
}

export interface LinkedInCampaignGroup {
  id: string | number;
  name: string;
  status?: string;
  account?: string;
  [key: string]: unknown;
}

export interface LinkedInCreative {
  id: string | number;
  name?: string;
  status?: string;
  campaign?: string;
  isServing?: boolean;
  [key: string]: unknown;
}

export interface LinkedInAdAccount {
  id: string | number;
  name?: string;
  status?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface AnalyticsRow {
  pivotValues?: string[];
  impressions?: number;
  clicks?: number;
  costInUsd?: number | string;
  externalWebsiteConversions?: number;
  landingPageClicks?: number;
  [key: string]: unknown;
}
