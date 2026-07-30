import { describe, expect, it } from "vitest";
import { recomputeKpisFromPull, type RecomputePull } from "@/domain/kpis/recompute";

function fixturePull(): RecomputePull {
  const today = new Date().toISOString().slice(0, 10);
  return {
    customers: [{ externalId: "C1" }],
    products: [
      { sku: "A1", abcClass: "A", unitCostBrl: 10, minStock: 100 },
      { sku: "B1", abcClass: "B", unitCostBrl: 5, minStock: 50 },
    ],
    orders: [
      {
        orderDate: today,
        requestedLines: 10,
        fulfilledLines: 9,
        onTimeInFull: true,
      },
    ],
    invoices: [
      {
        customerExternalId: "C1",
        invoiceDate: today,
        netAmountBrl: 1000,
        cogsBrl: 600,
      },
    ],
    receivables: [
      { dueDate: "2020-01-01", openAmountBrl: 200, status: "open" },
    ],
    payments: [{ paymentDate: today, amountBrl: 500 }],
    stock: [
      { sku: "A1", onHand: 40 },
      { sku: "B1", onHand: 80 },
    ],
    freight: [{ costDate: today, amountBrl: 40 }],
  };
}

describe("recomputeKpisFromPull", () => {
  it("produces catalog snapshots from a pull fixture", () => {
    const pull = fixturePull();
    const asOfDate = new Date().toISOString().slice(0, 10);
    const result = recomputeKpisFromPull(pull, {
      asOfDate,
      annualRevenueTargetBrl: 100_000_000,
      source: "test",
    });

    expect(result.snapshots.length).toBe(20);
    expect(result.metrics.revenueDay).toBe(1000);
    expect(result.metrics.stockoutSkuA).toBe(1);
    expect(result.metrics.fillRateDay).toBeCloseTo(0.9);
    expect(result.kpiSnapshots.every((s) => s.source === "test")).toBe(true);
  });
});
