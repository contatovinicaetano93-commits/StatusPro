import { AlertItemSchema } from "@/domain/alerts/schemas";
import type { AlertItem } from "@/domain/types";

const SEVERITY_WEIGHT: Record<AlertItem["severity"], number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 10,
};

export function alertScore(alert: AlertItem): number {
  // Severity dominates; impact breaks ties within the same severity.
  return SEVERITY_WEIGHT[alert.severity] * 1_000_000 + (alert.impactBrl ?? 0);
}

/** Rank open alerts by severity weight + financial impact. Validates at boundary. */
export function rankAlerts(alerts: AlertItem[]): AlertItem[] {
  const parsed = alerts.map((a) => AlertItemSchema.parse(a));
  return [...parsed].sort((a, b) => alertScore(b) - alertScore(a));
}

export function defaultSuggestedActions(alert: AlertItem): string[] {
  if (alert.suggestedActions.length) return alert.suggestedActions;
  return [
    "Quantificar impacto em caixa/margem",
    "Definir owner e prazo (hoje / esta semana)",
    "Reavaliar após próxima sync do ERP",
  ];
}
