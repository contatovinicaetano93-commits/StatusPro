import { describe, expect, it } from "vitest";
import { recomputeKpisFromPull } from "@/domain/kpis/recompute";
import { MockErpGateway } from "@/infrastructure/erp/mock-gateway";

describe("recomputeKpisFromPull", () => {
  it("produces catalog snapshots from a mock pull", async () => {
    const pull = await new MockErpGateway(42).pullFull();
    const asOfDate = new Date().toISOString().slice(0, 10);
    const result = recomputeKpisFromPull(pull, {
      asOfDate,
      annualRevenueTargetBrl: 100_000_000,
      source: "mock:sifwin",
    });

    expect(result.snapshots.length).toBe(20);
    expect(result.snapshots.some((s) => s.kpiId === "revenue_day")).toBe(true);
    expect(result.metrics.asOfDate).toBe(asOfDate);
    expect(result.kpiSnapshots.every((s) => s.source === "mock:sifwin")).toBe(true);
    expect(result.metrics.stockoutSkuA).toBeGreaterThanOrEqual(0);
  });
});
