import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { getCeoHome } from "@/application/get-ceo-home";

export default async function SalesPage() {
  const week = await getCeoHome("weekly");
  const month = await getCeoHome("monthly");
  const items = [...week.kpis.filter((k) => ["revenue_week", "gross_margin_week", "freight_pct_week"].includes(k.kpiId)), ...month.kpis.filter((k) => ["revenue_month", "gross_margin_month", "top10_concentration"].includes(k.kpiId))];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Vendas & Margem</h1>
      <p className="muted">Receita, margem e concentração — leia margem antes de acelerar volume.</p>
      <FreshnessBanner freshness={week.freshness} />
      <KpiStrip
        items={items.map((k) => ({
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
