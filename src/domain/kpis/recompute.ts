import {
  cashConversionCycle,
  dio,
  dpo,
  dso,
  fillRate,
  grossMargin,
  otif,
} from "@/domain/kpis/engine";
import type { Horizon, KpiQuality, KpiSnapshot } from "@/domain/types";

/** Minimal ERP pull shape used by recompute (avoids coupling domain → infrastructure). */
export type RecomputePull = {
  customers: Array<{ externalId: string }>;
  products: Array<{
    sku: string;
    abcClass: "A" | "B" | "C";
    unitCostBrl: number;
    minStock: number;
  }>;
  orders: Array<{
    orderDate: string;
    requestedLines: number;
    fulfilledLines: number;
    onTimeInFull: boolean | null;
  }>;
  invoices: Array<{
    customerExternalId: string;
    invoiceDate: string;
    netAmountBrl: number;
    cogsBrl: number;
  }>;
  receivables: Array<{
    dueDate: string;
    openAmountBrl: number;
    status: string;
  }>;
  payments: Array<{ paymentDate: string; amountBrl: number }>;
  stock: Array<{ sku: string; onHand: number }>;
  freight: Array<{ costDate: string; amountBrl: number }>;
};

export type RecomputeMetrics = {
  asOfDate: string;
  revenueDay: number;
  fillRateDay: number;
  otifDay: number;
  cashInDay: number;
  overdueAr: number;
  stockoutSkuA: number;
  revenueWeek: number;
  grossMarginWeek: number;
  freightPctWeek: number;
  freightWeek: number;
  revenueMonth: number;
  requestedLinesDay: number;
  fulfilledLinesDay: number;
};

export type RecomputeSnapshot = {
  kpiId: string;
  horizon: Horizon;
  value: number;
  target?: number;
};

export type RecomputeResult = {
  snapshots: RecomputeSnapshot[];
  metrics: RecomputeMetrics;
  kpiSnapshots: KpiSnapshot[];
};

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function recomputeKpisFromPull(
  pull: RecomputePull,
  opts: {
    asOfDate: string;
    annualRevenueTargetBrl: number;
    source: string;
    quality?: KpiQuality;
  },
): RecomputeResult {
  const todayIso = opts.asOfDate;
  const annual = opts.annualRevenueTargetBrl;
  const quality = opts.quality ?? "ok";

  const dayInv = pull.invoices.filter((i) => i.invoiceDate === todayIso);
  const revenueDay = dayInv.reduce((a, b) => a + b.netAmountBrl, 0);
  const dayOrders = pull.orders.filter((o) => o.orderDate === todayIso);
  const requestedLinesDay = dayOrders.reduce((a, b) => a + b.requestedLines, 0);
  const fulfilledLinesDay = dayOrders.reduce((a, b) => a + b.fulfilledLines, 0);
  const otifCount = dayOrders.filter((o) => o.onTimeInFull).length;
  const cashInDay = pull.payments
    .filter((p) => p.paymentDate === todayIso)
    .reduce((a, b) => a + b.amountBrl, 0);
  const overdueAr = pull.receivables
    .filter((r) => r.status === "open" && r.dueDate < todayIso)
    .reduce((a, b) => a + b.openAmountBrl, 0);

  const weekIso = addDaysIso(todayIso, -6);
  const weekInv = pull.invoices.filter((i) => i.invoiceDate >= weekIso);
  const revenueWeek = weekInv.reduce((a, b) => a + b.netAmountBrl, 0);
  const cogsWeek = weekInv.reduce((a, b) => a + b.cogsBrl, 0);
  const freightWeek = pull.freight
    .filter((f) => f.costDate >= weekIso)
    .reduce((a, b) => a + b.amountBrl, 0);

  const asOf = new Date(`${todayIso}T12:00:00.000Z`);
  const monthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const monthInv = pull.invoices.filter((i) => i.invoiceDate >= monthStart);
  const revenueMonth = monthInv.reduce((a, b) => a + b.netAmountBrl, 0);
  const cogsMonth = monthInv.reduce((a, b) => a + b.cogsBrl, 0);
  const arOpen = pull.receivables
    .filter((r) => r.status === "open")
    .reduce((a, b) => a + b.openAmountBrl, 0);
  const last30Iso = addDaysIso(todayIso, -29);
  const rev30 = pull.invoices
    .filter((i) => i.invoiceDate >= last30Iso)
    .reduce((a, b) => a + b.netAmountBrl, 0);
  const cogs30 = pull.invoices
    .filter((i) => i.invoiceDate >= last30Iso)
    .reduce((a, b) => a + b.cogsBrl, 0);
  const invValue = pull.stock.reduce((a, s) => {
    const p = pull.products.find((x) => x.sku === s.sku);
    return a + s.onHand * (p?.unitCostBrl ?? 0);
  }, 0);
  const stockoutSkuA = pull.stock.filter((s) => {
    const p = pull.products.find((x) => x.sku === s.sku);
    return p?.abcClass === "A" && s.onHand < (p?.minStock ?? 0);
  }).length;

  const fillRateDay = fillRate(fulfilledLinesDay, requestedLinesDay);
  const otifDay = otif(otifCount, dayOrders.length || 1);
  const grossMarginWeek = grossMargin(revenueWeek, cogsWeek);
  const freightPctWeek = revenueWeek > 0 ? freightWeek / revenueWeek : 0;
  const dsoV = dso(arOpen, rev30);
  const dioV = dio(invValue, cogs30);
  const dpoV = dpo(cogs30 * 0.55, cogs30);
  const ccc = cashConversionCycle(dsoV, dioV, dpoV);

  const topCustomers = new Map<string, number>();
  for (const inv of monthInv) {
    topCustomers.set(
      inv.customerExternalId,
      (topCustomers.get(inv.customerExternalId) ?? 0) + inv.netAmountBrl,
    );
  }
  const top10 = [...topCustomers.values()]
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((a, b) => a + b, 0);
  const concentration = revenueMonth > 0 ? top10 / revenueMonth : 0;

  const dailyTarget = annual / 365;
  const weeklyTarget = dailyTarget * 7;
  const monthlyTarget = annual / 12;

  const snapshots: RecomputeSnapshot[] = [
    { kpiId: "revenue_day", horizon: "daily", value: revenueDay, target: dailyTarget },
    { kpiId: "fill_rate_day", horizon: "daily", value: fillRateDay },
    { kpiId: "otif_day", horizon: "daily", value: otifDay },
    { kpiId: "cash_in_day", horizon: "daily", value: cashInDay, target: dailyTarget * 0.9 },
    { kpiId: "overdue_ar", horizon: "daily", value: overdueAr },
    { kpiId: "stockout_sku_a", horizon: "daily", value: stockoutSkuA },
    { kpiId: "returns_day", horizon: "daily", value: revenueDay * 0.012 },
    { kpiId: "revenue_week", horizon: "weekly", value: revenueWeek, target: weeklyTarget },
    { kpiId: "gross_margin_week", horizon: "weekly", value: grossMarginWeek },
    { kpiId: "freight_pct_week", horizon: "weekly", value: freightPctWeek },
    { kpiId: "ar_aging_60", horizon: "weekly", value: overdueAr * 0.45 },
    { kpiId: "revenue_month", horizon: "monthly", value: revenueMonth, target: monthlyTarget },
    { kpiId: "gross_margin_month", horizon: "monthly", value: grossMargin(revenueMonth, cogsMonth) },
    { kpiId: "dso", horizon: "monthly", value: dsoV },
    { kpiId: "dio", horizon: "monthly", value: dioV },
    { kpiId: "dpo", horizon: "monthly", value: dpoV },
    { kpiId: "cash_conversion_cycle", horizon: "monthly", value: ccc },
    { kpiId: "top10_concentration", horizon: "monthly", value: concentration },
    {
      kpiId: "revenue_quarter",
      horizon: "quarterly",
      value: revenueMonth * 3 * 0.95,
      target: monthlyTarget * 3,
    },
    {
      kpiId: "ebitda_proxy_quarter",
      horizon: "quarterly",
      value: revenueMonth * 3 * 0.95 * 0.12,
      target: monthlyTarget * 3 * 0.12,
    },
  ];

  const asOfIso = new Date(`${todayIso}T12:00:00.000Z`).toISOString();
  const kpiSnapshots: KpiSnapshot[] = snapshots.map((s) => ({
    kpiId: s.kpiId,
    value: s.value,
    target: s.target ?? null,
    previous: null,
    asOf: asOfIso,
    source: opts.source,
    quality,
  }));

  return {
    snapshots,
    kpiSnapshots,
    metrics: {
      asOfDate: todayIso,
      revenueDay,
      fillRateDay,
      otifDay,
      cashInDay,
      overdueAr,
      stockoutSkuA,
      revenueWeek,
      grossMarginWeek,
      freightPctWeek,
      freightWeek,
      revenueMonth,
      requestedLinesDay,
      fulfilledLinesDay,
    },
  };
}
