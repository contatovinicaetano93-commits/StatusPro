import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { getKpiBoard } from "@/application/get-ceo-home";

export default async function SalesPage() {
  const board = await getKpiBoard({
    horizons: ["weekly", "monthly"],
    kpiIds: [
      "revenue_week",
      "gross_margin_week",
      "freight_pct_week",
      "revenue_month",
      "gross_margin_month",
      "top10_concentration",
    ],
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Vendas & Margem</h1>
      <p className="muted">Receita, margem e concentração — leia margem antes de acelerar volume.</p>
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
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Leitura executiva</h2>
        <p style={{ marginBottom: 0, lineHeight: 1.5 }}>
          Se margem semanal cair com frete % subindo, o problema pode ser mix regional (UF cara) — não só
          desconto comercial. Cruze com Risco / frete por UF e com rupturas (substituição forçada derruba
          margem).
        </p>
      </section>
    </div>
  );
}
