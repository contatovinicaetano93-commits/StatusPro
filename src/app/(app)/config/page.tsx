import { getConfigView } from "@/application/get-config-view";

export default async function ConfigPage() {
  const view = await getConfigView();

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Config</h1>
      <p className="muted">Metas, thresholds, integrações e papéis — onboarding do tenant.</p>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Onboarding</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Conectar fonte (hoje: mock ERP · depois FKN/SIFWin)</li>
          <li>Mapear UF/regiões e CD principal (SP)</li>
          <li>Definir metas anuais/mensais/diárias</li>
          <li>Gerar o primeiro briefing do CEO</li>
        </ol>
      </section>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Feature flags</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {view.featureFlags.map((f) => (
            <li key={f.id}>
              <code>{f.id}</code> — {f.enabled ? "on" : "off"}
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>
          Fonte: FEATURE_FLAGS={view.featureFlagsRaw}
        </p>
      </section>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Papéis</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {view.roles.map((r) => (
            <li key={r.id}>{r.label}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          Catálogo de KPIs ({view.kpis.length})
        </h2>
        <div style={{ display: "grid", gap: "0.65rem", fontSize: 14 }}>
          {view.kpis.map((k) => (
            <div key={k.id} style={{ borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}>
              <strong>
                {k.name} <span className="muted">({k.id})</span>
              </strong>
              <div className="muted">
                {k.horizon} · {k.unit} · owner {k.owner}
              </div>
              <div className="muted">{k.formula}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
