import { getKpiDefinition, formatKpiValue } from "@/domain/kpis/engine";
import type { AlertItem } from "@/domain/types";

export type KpiEvidence = {
  kpiId: string;
  label: string;
  valueFormatted: string;
  period: string;
};

/** Deterministic KPI narrative — lives in domain, not AI. */
export function explainKpiDeviation(args: {
  kpiId: string;
  value: number;
  target?: number | null;
  band: string;
  relatedAlerts: AlertItem[];
}): { summary: string; evidence: KpiEvidence[]; actions: string[] } {
  const def = getKpiDefinition(args.kpiId);
  if (!def) {
    return {
      summary: "KPI não encontrado no catálogo. Não invento número sem definição.",
      evidence: [],
      actions: ["Verificar id do KPI em domain/kpis/catalog"],
    };
  }
  const formatted = formatKpiValue(def, args.value);
  const targetText =
    args.target != null ? ` Meta: ${formatKpiValue(def, args.target)}.` : "";
  const alertHints = args.relatedAlerts.map((a) => a.title).slice(0, 3);
  const summary = [
    `${def.name} está ${args.band === "green" ? "no alvo" : args.band === "yellow" ? "em atenção" : "fora do alvo"}: ${formatted}.${targetText}`,
    `Fórmula: ${def.formula}. Fonte: ${def.source}.`,
    alertHints.length ? `Sinais correlatos: ${alertHints.join("; ")}.` : "Sem alertas correlatos abertos.",
  ].join(" ");

  return {
    summary,
    evidence: [
      {
        kpiId: def.id,
        label: def.name,
        valueFormatted: formatted,
        period: "período corrente",
      },
    ],
    actions: def.playbook ?? ["Investigar breakdown por região/cliente/SKU", "Validar freshness da sync"],
  };
}
