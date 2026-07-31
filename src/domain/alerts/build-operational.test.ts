import { describe, expect, it } from "vitest";
import { buildOperationalAlerts } from "@/domain/alerts/build-operational";
import type { RecomputeMetrics } from "@/domain/kpis/recompute";

function metrics(partial: Partial<RecomputeMetrics>): RecomputeMetrics {
  return {
    asOfDate: "2026-07-30",
    revenueDay: 1_000_000,
    fillRateDay: 0.98,
    otifDay: 0.95,
    cashInDay: 500_000,
    overdueAr: 500_000,
    stockoutSkuA: 0,
    revenueWeek: 5_000_000,
    grossMarginWeek: 0.3,
    freightPctWeek: 0.03,
    freightWeek: 150_000,
    revenueMonth: 20_000_000,
    requestedLinesDay: 100,
    fulfilledLinesDay: 98,
    ...partial,
  };
}

describe("buildOperationalAlerts", () => {
  it("emits nothing when all managed KPIs are green", () => {
    expect(buildOperationalAlerts(metrics({}))).toEqual([]);
  });

  it("emits stockout when above green threshold", () => {
    const alerts = buildOperationalAlerts(metrics({ stockoutSkuA: 5 }));
    expect(alerts.map((a) => a.kpiId)).toEqual(["stockout_sku_a"]);
  });

  it("emits fill rate when below yellow band", () => {
    const alerts = buildOperationalAlerts(metrics({ fillRateDay: 0.8 }));
    expect(alerts.some((a) => a.kpiId === "fill_rate_day")).toBe(true);
  });

  it("emits multiple when several KPIs breach", () => {
    const alerts = buildOperationalAlerts(
      metrics({
        stockoutSkuA: 10,
        overdueAr: 5_000_000,
        fillRateDay: 0.85,
        freightPctWeek: 0.07,
      }),
    );
    expect(alerts.map((a) => a.kpiId).sort()).toEqual(
      ["fill_rate_day", "freight_pct_week", "overdue_ar", "stockout_sku_a"].sort(),
    );
  });
});
