import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { getKpiBoard } from "@/application/get-ceo-home";
import type { Horizon } from "@/domain/types";
import { notFound } from "next/navigation";

const LABELS: Record<Horizon, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
};

export default async function HorizonPage({
  params,
}: {
  params: Promise<{ horizon: string }>;
}) {
  const { horizon: raw } = await params;
  if (!["daily", "weekly", "monthly", "quarterly"].includes(raw)) notFound();
  const horizon = raw as Horizon;
  const board = await getKpiBoard({ horizons: [horizon] });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Horizonte {LABELS[horizon]}</h1>
      <p className="muted">KPIs do horizonte com fórmula no tooltip de cada indicador.</p>
      <FreshnessBanner freshness={board.freshness} />
      <KpiStrip
        items={board.kpis.map((k) => ({
          definition: k.definition,
          value: k.value,
          target: k.target,
          band: k.band,
          formatted: k.formatted,
          quality: k.quality,
        }))}
      />
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Definições</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {board.kpis.map((k) => (
            <div key={k.kpiId}>
              <strong>{k.definition.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {k.definition.description} · {k.definition.formula} · fonte {k.definition.source}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
