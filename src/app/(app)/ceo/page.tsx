import { FreshnessBanner } from "@/components/freshness-banner";
import { KpiStrip } from "@/components/kpi-strip";
import { AskPanel, BriefingActions } from "@/components/ask-panel";
import { getCeoHome } from "@/application/get-ceo-home";
import { explainKpiDeviation, rankAlerts, suggestActions } from "@/ai/tools";
import { isFeatureEnabled } from "@/lib/env";

export default async function CeoPage() {
  const home = await getCeoHome("daily");
  const ranked = rankAlerts(home.alerts);

  return (
    <div>
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: 0, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12 }}>
          Horizonte diário
        </p>
        <h1 style={{ margin: "0.35rem 0", fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          Pulse do negócio
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {home.org?.name ?? "Tenant não seedado"} — o que está errado, por quê, o que fazer agora.
        </p>
      </header>

      <FreshnessBanner freshness={home.freshness} />

      <KpiStrip
        items={home.kpis.map((k) => ({
          definition: k.definition,
          value: k.value,
          target: k.target,
          band: k.band,
          formatted: k.formatted,
          quality: k.quality,
        }))}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "1rem",
          marginTop: "1rem",
        }}
        className="ceo-grid"
      >
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Briefing do CEO</h2>
            {isFeatureEnabled("ai_briefing") ? <BriefingActions /> : null}
          </div>
          <article style={{ marginTop: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 15 }}>
            {home.briefing?.contentMd ??
              "Nenhum briefing ainda. Clique em Gerar briefing IA ou rode o seed."}
          </article>
          {home.briefing?.model ? (
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Modelo: {home.briefing.model}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem" }}>Alertas priorizados</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {ranked.length === 0 ? (
              <p className="muted">Sem alertas abertos. Próximo passo: validar metas do mês em Config.</p>
            ) : (
              ranked.map((a) => {
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
                  <div key={a.id} style={{ borderTop: "1px solid var(--line)", paddingTop: "0.65rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{a.title}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="muted" style={{ margin: "0.35rem 0", fontSize: 14 }}>
                      {a.detail}
                    </p>
                    {explain ? (
                      <p style={{ margin: "0 0 0.4rem", fontSize: 13 }}>{explain.summary}</p>
                    ) : null}
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 13 }}>
                      {suggestActions(a).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <section className="panel">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem" }}>Checklist diário</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.7 }}>
            {home.checklist.map((c) => (
              <li key={c.id} className={c.done ? "muted" : undefined}>
                {c.done ? "✓ " : "○ "}
                {c.label}
              </li>
            ))}
          </ul>
        </section>
        <AskPanel
          kpis={home.kpis.map((k) => ({
            kpiId: k.kpiId,
            value: k.value,
            target: k.target,
            band: k.band,
          }))}
          alerts={home.alerts}
        />
      </div>

      <style>{`
        @media (max-width: 960px) {
          .ceo-grid, .ceo-grid + div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
