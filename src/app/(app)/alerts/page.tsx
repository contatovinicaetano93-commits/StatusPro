import { getAlertsBoard } from "@/application/get-alerts-board";

export default async function AlertsPage() {
  const board = await getAlertsBoard();

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Alertas & Playbooks</h1>
      <p className="muted">Severidade × impacto. Cada alerta traz próximo passo explícito.</p>

      <div style={{ display: "grid", gap: "0.85rem", marginBottom: "1.25rem" }}>
        {board.rankedAlerts.length === 0 ? (
          <p className="muted panel">Sem alertas abertos. Próximo passo: revisar metas em Config.</p>
        ) : (
          board.rankedAlerts.map((a) => (
            <article key={a.id} className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{a.title}</strong>
                <span className="muted">{a.severity}</span>
              </div>
              <p className="muted">{a.detail}</p>
              {a.explanation ? <p style={{ fontSize: 14 }}>{a.explanation}</p> : null}
              <div style={{ fontSize: 14 }}>
                <strong>Ações:</strong>
                <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
                  {a.actions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        )}
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Playbooks do catálogo</h2>
        {board.playbooks.map((k) => (
          <div key={k.id} style={{ marginBottom: "0.85rem" }}>
            <strong>{k.name}</strong>
            <ul className="muted" style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem", fontSize: 14 }}>
              {k.steps.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
