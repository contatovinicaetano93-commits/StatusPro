import { getCeoHome } from "@/application/get-ceo-home";
import { explainKpiDeviation, rankAlerts, suggestActions } from "@/ai/tools";
import { KPI_CATALOG } from "@/domain/kpis/catalog";

export default async function AlertsPage() {
  const home = await getCeoHome("daily");
  const ranked = rankAlerts(home.alerts);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Alertas & Playbooks</h1>
      <p className="muted">Severidade × impacto. Cada alerta traz próximo passo explícito.</p>

      <div style={{ display: "grid", gap: "0.85rem", marginBottom: "1.25rem" }}>
        {ranked.map((a) => {
          const related = home.kpis.find((k) => k.kpiId === a.kpiId);
          const explain =
            related && a.kpiId
              ? explainKpiDeviation({
                  kpiId: a.kpiId,
                  value: related.value,
                  target: related.target,
                  band: related.band,
                  relatedAlerts: [a],
                })
              : null;
          return (
            <article key={a.id} className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{a.title}</strong>
                <span className="muted">{a.severity}</span>
              </div>
              <p className="muted">{a.detail}</p>
              {explain ? <p style={{ fontSize: 14 }}>{explain.summary}</p> : null}
              <div style={{ fontSize: 14 }}>
                <strong>Ações:</strong>
                <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
                  {suggestActions(a).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Playbooks do catálogo</h2>
        {KPI_CATALOG.filter((k) => k.playbook?.length).map((k) => (
          <div key={k.id} style={{ marginBottom: "0.85rem" }}>
            <strong>{k.name}</strong>
            <ul className="muted" style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem", fontSize: 14 }}>
              {k.playbook?.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
