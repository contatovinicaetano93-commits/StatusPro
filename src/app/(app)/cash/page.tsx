import { FreshnessBanner } from "@/components/freshness-banner";
import { getCashBoard } from "@/application/get-cash-board";

export default async function CashPage() {
  const board = await getCashBoard();
  const cash = board.kpis.find((k) => k.kpiId === "cash_in_day");
  const overdue = board.kpis.find((k) => k.kpiId === "overdue_ar");
  const aging = board.kpis.find((k) => k.kpiId === "ar_aging_60");

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Caixa & Recebíveis</h1>
      <p className="muted">Fluxo do dia, inadimplência e aging — foco em ação de cobrança.</p>
      <FreshnessBanner freshness={board.freshness} />

      <div className="grid-kpi" style={{ marginBottom: "1rem" }}>
        {[cash, overdue, aging].filter(Boolean).map((k) =>
          k ? (
            <article key={k.kpiId} className="panel">
              <div className="muted" style={{ fontSize: 12 }}>
                {k.definition.name}
              </div>
              <div className={`band-${k.band}`} style={{ fontSize: "1.4rem", fontWeight: 600 }}>
                {k.formatted}
              </div>
            </article>
          ) : null,
        )}
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Top clientes em atraso</h2>
        {board.overdueCustomers.length === 0 ? (
          <p className="muted">Sem títulos vencidos no seed — ou rode a sync.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr className="muted">
                <th style={{ textAlign: "left", padding: "0.4rem 0" }}>Cliente</th>
                <th style={{ textAlign: "left" }}>UF</th>
                <th style={{ textAlign: "right" }}>Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {board.overdueCustomers.map((c) => (
                <tr key={`${c.name}-${c.uf}`} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    {c.name}
                    {c.isNationalAccount ? " · nacional" : ""}
                  </td>
                  <td>{c.uf}</td>
                  <td style={{ textAlign: "right" }}>{c.openAmountFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Playbook: cobrar top 10 → bloquear crédito se política exigir → acordo com desconto se ROI positivo.
        </p>
      </section>
    </div>
  );
}
