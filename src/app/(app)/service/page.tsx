import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { getKpiBoard } from "@/application/get-ceo-home";

export default async function ServicePage() {
  const board = await getKpiBoard({
    horizons: ["daily"],
    kpiIds: ["fill_rate_day", "otif_day", "returns_day", "stockout_sku_a"],
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Serviço (Fill rate / OTIF)</h1>
      <p className="muted">Pedidos completos e no prazo — a métrica que contas nacionais cobram.</p>
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
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Playbook fill rate &lt; 95%</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Listar SKUs A em ruptura e pedidos nacionais afetados</li>
          <li>Emitir OC emergencial / transferir entre CDs</li>
          <li>Oferecer substituto homologado e registrar aceite</li>
          <li>Revisar forecast dos top 20 SKUs A na sexta</li>
        </ol>
      </section>
    </div>
  );
}
