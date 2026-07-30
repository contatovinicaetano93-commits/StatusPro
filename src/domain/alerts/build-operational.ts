import { OperationalAlertDraftSchema, type OperationalAlertDraft } from "@/domain/alerts/schemas";
import type { RecomputeMetrics } from "@/domain/kpis/recompute";

/** Deterministic operational alerts from KPI recompute metrics (same spirit as seed). */
export function buildOperationalAlerts(metrics: RecomputeMetrics): OperationalAlertDraft[] {
  const drafts: OperationalAlertDraft[] = [
    {
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
    {
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
    {
      severity: "high",
      title: "Fill rate sob pressão",
      detail: `Fill rate do dia em ${(metrics.fillRateDay * 100).toFixed(1)}%.`,
      kpiId: "fill_rate_day",
      impactBrl: metrics.revenueDay * 0.05,
      suggestedActions: ["Priorizar picking SKU A", "Congelar promoções de itens críticos"],
    },
    {
      severity: "medium",
      title: "Frete elevado em algumas UFs",
      detail: `Frete da semana em ${(metrics.freightPctWeek * 100).toFixed(1)}% da receita.`,
      kpiId: "freight_pct_week",
      impactBrl: metrics.freightWeek * 0.15,
      suggestedActions: ["Revisar tabela frete BA/PE", "Consolidar cargas semanais Nordeste"],
    },
  ];

  return drafts.map((d) => OperationalAlertDraftSchema.parse(d));
}
