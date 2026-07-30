import type { Freshness } from "@/domain/types";

export function FreshnessBanner({ freshness }: { freshness: Freshness }) {
  if (!freshness.asOf) {
    return (
      <div className="banner-stale">
        Sem dados sincronizados. Rode <code>npm run db:migrate && npm run db:seed</code> ou abra o Sync
        Center.
      </div>
    );
  }
  if (freshness.quality === "ok" && (freshness.ageMinutes ?? 0) <= 180) {
    return (
      <p className="muted" style={{ margin: "0 0 1rem", fontSize: 13 }}>
        Atualizado há {freshness.ageMinutes} min · fonte {freshness.source}
      </p>
    );
  }
  return (
    <div className="banner-stale">
      Dados em modo degradado ({freshness.quality}). Última atualização há {freshness.ageMinutes ?? "?"} min
      {freshness.source ? ` · ${freshness.source}` : ""}. Decisões críticas: confirme no ERP se necessário.
    </div>
  );
}
