import { getEnv } from "@/lib/env";
import { getOrganizationBySlug, getSyncRuns } from "@/infrastructure/db/repositories";
import { SyncControls } from "@/components/sync-controls";

export default async function SyncPage() {
  const org = await getOrganizationBySlug(getEnv().NEXT_PUBLIC_DEFAULT_ORG_SLUG);
  const runs = org ? await getSyncRuns(org.id) : [];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Sync Center</h1>
      <p className="muted">
        Integração via <code>ErpGateway</code> (mock agora; FKN/SIFWin quando houver API). Jobs
        idempotentes com log de execução.
      </p>
      <SyncControls />
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
                <tr key={String(r.id)} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    {new Date(String(r.started_at)).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ textAlign: "center" }}>{String(r.source)}</td>
                  <td style={{ textAlign: "center" }}>{String(r.mode)}</td>
                  <td style={{ textAlign: "center" }}>{String(r.status)}</td>
                  <td style={{ textAlign: "right" }}>
                    {Number(r.records_ok)}/{Number(r.records_error)}
                  </td>
                  <td style={{ textAlign: "right" }}>{r.latency_ms != null ? Number(r.latency_ms) : "—"}</td>
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
          <li>Implementar métodos em <code>FknSifwinErpGateway</code></li>
          <li>Validar payloads com Zod schemas em <code>gateway.ts</code></li>
          <li>Setar <code>ERP_MODE=fkn</code> e credenciais</li>
        </ol>
      </section>
    </div>
  );
}
