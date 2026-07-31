import { getSyncCenter } from "@/application/get-sync-center";
import { DeadLetterActions, SyncControls } from "@/components/sync-controls";

export default async function SyncPage() {
  const { runs, deadLetters, circuitOpen } = await getSyncCenter();

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Sync Center</h1>
      <p className="muted">
        Integração via <code>ErpGateway</code> (mock agora; FKN/SIFWin quando houver API). Pipeline
        orquestrado no use-case <code>runErpSync</code> — KPIs recomputados dos fatos no DB.
      </p>
      <SyncControls circuitOpen={circuitOpen} />
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Últimas execuções</h2>
        {runs.length === 0 ? (
          <p className="muted">Nenhuma sync registrada. Rode o seed ou dispare uma sync mock.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr className="muted">
                <th style={{ textAlign: "left", padding: "0.4rem 0" }}>Quando</th>
                <th>Fonte</th>
                <th>Modo</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>OK/Erro</th>
                <th style={{ textAlign: "right" }}>ms</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    {new Date(r.startedAt).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ textAlign: "center" }}>{r.source}</td>
                  <td style={{ textAlign: "center" }}>{r.mode}</td>
                  <td style={{ textAlign: "center" }}>{r.status}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.recordsOk}/{r.recordsError}
                  </td>
                  <td style={{ textAlign: "right" }}>{r.latencyMs != null ? r.latencyMs : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          Dead letters abertas ({deadLetters.length})
        </h2>
        {deadLetters.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nenhuma entidade rejeitada pendente.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr className="muted">
                <th style={{ textAlign: "left", padding: "0.4rem 0" }}>Quando</th>
                <th style={{ textAlign: "left" }}>Tipo</th>
                <th style={{ textAlign: "left" }}>Erro</th>
                <th style={{ textAlign: "left" }}>Payload</th>
                <th style={{ textAlign: "left" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {deadLetters.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.45rem 0", whiteSpace: "nowrap" }}>
                    {new Date(d.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td>
                    <code>{d.entityType}</code>
                  </td>
                  <td>{d.errorMessage}</td>
                  <td
                    className="muted"
                    style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {d.payloadPreview}
                  </td>
                  <td>
                    <DeadLetterActions id={d.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Plugar FKN/SIFWin</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Obter docs/API com suporte FKN</li>
          <li>
            Implementar métodos em <code>FknSifwinErpGateway</code>
          </li>
          <li>
            Validar payloads com Zod schemas em <code>gateway.ts</code>
          </li>
          <li>
            Setar <code>ERP_MODE=fkn</code> e credenciais
          </li>
        </ol>
      </section>
    </div>
  );
}
