import { defaultSuggestedActions, rankAlerts } from "@/domain/alerts/rank";
import { explainKpiDeviation } from "@/domain/kpis/explain";
import type { AlertItem } from "@/domain/types";

export type RankedAlertView = AlertItem & {
  explanation: string | null;
  actions: string[];
};

type KpiLike = {
  kpiId: string;
  value: number;
  target?: number | null;
  band: string;
};

/** Single ranking + optional domain explain path for boards and AI. */
export function toRankedAlertView(
  alerts: AlertItem[],
  opts?: { kpis?: KpiLike[]; limit?: number; withExplain?: boolean },
): RankedAlertView[] {
  const limit = opts?.limit ?? 8;
  const withExplain = opts?.withExplain ?? Boolean(opts?.kpis?.length);

  return rankAlerts(alerts)
    .slice(0, limit)
    .map((a) => {
      const related = opts?.kpis?.find((k) => k.kpiId === a.kpiId);
      const explanation =
        withExplain && related && a.kpiId
          ? explainKpiDeviation({
              kpiId: a.kpiId,
              value: related.value,
              target: related.target,
              band: related.band,
              relatedAlerts: [a],
            }).summary
          : null;
      return {
        ...a,
        explanation,
        actions: defaultSuggestedActions(a),
      };
    });
}
