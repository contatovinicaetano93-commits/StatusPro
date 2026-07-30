import { KPI_CATALOG } from "@/domain/kpis/catalog";
import type { KpiDefinition, KpiSnapshot, ThresholdBand } from "@/domain/types";

export function getKpiDefinition(kpiId: string): KpiDefinition | undefined {
  return KPI_CATALOG.find((k) => k.id === kpiId);
}

export function listKpisByHorizon(horizon: KpiDefinition["horizon"]): KpiDefinition[] {
  return KPI_CATALOG.filter((k) => k.horizon === horizon);
}

/**
 * Band evaluation:
 * - For higherIsBetter vs target ratio metrics (target present): value/target vs green/yellow ratios
 * - For absolute thresholds: compare value to green/yellow cutoffs respecting direction
 */
export function evaluateBand(
  def: KpiDefinition,
  value: number,
  target?: number | null,
): ThresholdBand {
  if (target != null && target !== 0 && def.unit === "BRL" && def.higherIsBetter) {
    const ratio = value / target;
    if (ratio >= def.thresholds.green) return "green";
    if (ratio >= def.thresholds.yellow) return "yellow";
    return "red";
  }

  if (def.higherIsBetter) {
    if (value >= def.thresholds.green) return "green";
    if (value >= def.thresholds.yellow) return "yellow";
    return "red";
  }

  if (value <= def.thresholds.green) return "green";
  if (value <= def.thresholds.yellow) return "yellow";
  return "red";
}

export function formatKpiValue(def: KpiDefinition, value: number): string {
  switch (def.unit) {
    case "BRL":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "days":
      return `${value.toFixed(0)} d`;
    case "count":
      return new Intl.NumberFormat("pt-BR").format(value);
    case "ratio":
      return value.toFixed(2);
    default: {
      const _exhaustive: never = def.unit;
      return String(_exhaustive);
    }
  }
}

export function cashConversionCycle(dso: number, dio: number, dpo: number): number {
  return dso + dio - dpo;
}

export function grossMargin(revenue: number, cogs: number): number {
  if (revenue <= 0) return 0;
  return (revenue - cogs) / revenue;
}

export function fillRate(fulfilledLines: number, requestedLines: number): number {
  if (requestedLines <= 0) return 1;
  return fulfilledLines / requestedLines;
}

export function otif(onTimeInFull: number, ordersDue: number): number {
  if (ordersDue <= 0) return 1;
  return onTimeInFull / ordersDue;
}

export function dso(arOpen: number, revenueLast30d: number): number {
  if (revenueLast30d <= 0) return 0;
  return (arOpen / revenueLast30d) * 30;
}

export function dio(inventoryValue: number, cogsLast30d: number): number {
  if (cogsLast30d <= 0) return 0;
  return (inventoryValue / cogsLast30d) * 30;
}

export function dpo(apOpen: number, cogsLast30d: number): number {
  if (cogsLast30d <= 0) return 0;
  return (apOpen / cogsLast30d) * 30;
}

export function withBand(def: KpiDefinition, snap: KpiSnapshot) {
  return {
    ...snap,
    definition: def,
    band: evaluateBand(def, snap.value, snap.target),
    formatted: formatKpiValue(def, snap.value),
  };
}
