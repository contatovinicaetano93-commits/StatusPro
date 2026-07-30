import { FreshnessBanner } from "@/components/freshness-banner";
import { getInventoryBoard } from "@/application/get-ceo-home";

export default async function InventoryPage() {
  const board = await getInventoryBoard();
  const stockouts = board.stockoutKpi;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Estoque & Rupturas</h1>
      <p className="muted">Foco em SKUs A — ruptura destrói fill rate e margem de contas nacionais.</p>
      <FreshnessBanner freshness={board.freshness} />
      {stockouts ? (
        <article className="panel" style={{ marginBottom: "1rem" }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {stockouts.definition.name}
          </div>
          <div className={`band-${stockouts.band}`} style={{ fontSize: "1.6rem", fontWeight: 600 }}>
            {stockouts.formatted}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {stockouts.definition.formula}
          </p>
        </article>
      ) : null}
      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>SKUs A abaixo do mínimo</h2>
        {board.stockouts.length === 0 ? (
          <p className="muted">Nenhuma ruptura A no momento.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr className="muted">
                <th style={{ textAlign: "left", padding: "0.4rem 0" }}>SKU</th>
                <th style={{ textAlign: "left" }}>Família</th>
                <th style={{ textAlign: "right" }}>On hand</th>
                <th style={{ textAlign: "right" }}>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {board.stockouts.map((s) => (
                <tr key={String(s.sku)} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    <strong>{String(s.sku)}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {String(s.name)}
                    </div>
                  </td>
                  <td>{String(s.family)}</td>
                  <td style={{ textAlign: "right" }}>{Number(s.on_hand)}</td>
                  <td style={{ textAlign: "right" }}>{Number(s.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Se fill rate &lt; 95%: (1) OC emergencial SKU A, (2) realocar CD, (3) substituto homologado.
        </p>
      </section>
    </div>
  );
}
