import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { getKpiBoard } from "@/application/get-ceo-home";

export default async function RiskPage() {
  const board = await getKpiBoard({
    horizons: ["monthly", "weekly"],
    kpiIds: ["top10_concentration", "dso", "cash_conversion_cycle", "freight_pct_week"],
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Risco</h1>
      <p className="muted">Concentração de clientes, ciclo de caixa e frete — riscos silenciosos.</p>
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
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>O que vigiar</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Top 10 clientes &gt; 45% da receita → hunter mid-market</li>
          <li>DSO subindo com sales ok → problema é crédito/cobrança, não demanda</li>
          <li>Frete % acima de 6% → consolidar cargas Nordeste/Centro-Oeste</li>
        </ul>
      </section>
    </div>
  );
}
