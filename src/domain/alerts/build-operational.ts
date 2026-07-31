import { OperationalAlertDraftSchema, type OperationalAlertDraft } from "@/domain/alerts/schemas";
import { evaluateBand, getKpiDefinition } from "@/domain/kpis/engine";
import type { RecomputeMetrics } from "@/domain/kpis/recompute";

/** KPI ids managed by the operational-alert builder — always resolved on replace. */
export const OPERATIONAL_ALERT_KPI_IDS = [
  "stockout_sku_a",
  "overdue_ar",
  "fill_rate_day",
  "freight_pct_week",
] as const;

type Candidate = {
  kpiId: (typeof OPERATIONAL_ALERT_KPI_IDS)[number];
  value: number;
  draft: Omit<OperationalAlertDraft, "kpiId"> & { kpiId: string };
};

/** Deterministic operational alerts — only when KPI band is yellow or red. */
export function buildOperationalAlerts(metrics: RecomputeMetrics): OperationalAlertDraft[] {
  const candidates: Candidate[] = [
    {
      kpiId: "stockout_sku_a",
      value: metrics.stockoutSkuA,
      draft: {
        severity: "critical",
        title: "Ruptura em SKUs A",
        detail: `${metrics.stockoutSkuA} SKUs classe A abaixo do mínimo no CD-SP.`,
        kpiId: "stockout_sku_a",
        impactBrl: metrics.stockoutSkuA * 85_000,
        suggestedActions: [
          "Emitir OC emergencial",
          "Realocar estoque interestadual",
          "Oferecer substituto aos pedidos abertos",
        ],
      },
    },
    {
      kpiId: "overdue_ar",
      value: metrics.overdueAr,
      draft: {
        severity: "high",
        title: "Inadimplência acima do limiar",
        detail: `Recebíveis vencidos em R$ ${metrics.overdueAr.toFixed(0)}.`,
        kpiId: "overdue_ar",
        impactBrl: metrics.overdueAr * 0.08,
        suggestedActions: [
          "Cobrar top 10 por valor",
          "Acionar jurídico >90d",
          "Revisar limite de crédito",
        ],
      },
    },
    {
      kpiId: "fill_rate_day",
      value: metrics.fillRateDay,
      draft: {
        severity: "high",
        title: "Fill rate sob pressão",
        detail: `Fill rate do dia em ${(metrics.fillRateDay * 100).toFixed(1)}%.`,
        kpiId: "fill_rate_day",
        impactBrl: metrics.revenueDay * 0.05,
        suggestedActions: ["Priorizar picking SKU A", "Congelar promoções de itens críticos"],
      },
    },
    {
      kpiId: "freight_pct_week",
      value: metrics.freightPctWeek,
      draft: {
        severity: "medium",
        title: "Frete elevado em algumas UFs",
        detail: `Frete da semana em ${(metrics.freightPctWeek * 100).toFixed(1)}% da receita.`,
        kpiId: "freight_pct_week",
        impactBrl: metrics.freightWeek * 0.15,
        suggestedActions: ["Revisar tabela frete BA/PE", "Consolidar cargas semanais Nordeste"],
      },
    },
  ];

  return candidates
    .filter((c) => {
      const def = getKpiDefinition(c.kpiId);
      if (!def) return false;
      const band = evaluateBand(def, c.value);
      return band === "yellow" || band === "red";
    })
    .map((c) => OperationalAlertDraftSchema.parse(c.draft));
}
