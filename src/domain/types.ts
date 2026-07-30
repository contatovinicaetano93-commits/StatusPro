export type Horizon = "daily" | "weekly" | "monthly" | "quarterly";

export type KpiUnit = "BRL" | "percent" | "days" | "count" | "ratio";

export type KpiQuality = "ok" | "stale" | "partial" | "error";

export type ThresholdBand = "green" | "yellow" | "red";

export type KpiOwner = "finance" | "commercial" | "operations" | "ceo";

export type KpiDefinition = {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: KpiUnit;
  horizon: Horizon;
  owner: KpiOwner;
  /** Higher is better unless inverted */
  higherIsBetter: boolean;
  thresholds: {
    green: number;
    yellow: number;
  };
  source: string;
  playbook?: string[];
};

export type KpiSnapshot = {
  kpiId: string;
  value: number;
  target?: number | null;
  previous?: number | null;
  asOf: string;
  source: string;
  quality: KpiQuality;
  meta?: Record<string, unknown>;
};

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  kpiId?: string;
  impactBrl?: number;
  suggestedActions: string[];
  createdAt: string;
};

export type Freshness = {
  asOf: string | null;
  ageMinutes: number | null;
  quality: KpiQuality;
  source: string | null;
};

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
};
