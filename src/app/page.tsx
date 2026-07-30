const pillars = [
  {
    name: "Caixa",
    summary: "Receber vencido, a pagar 7 dias e projeção 15/30.",
    status: "Em breve",
  },
  {
    name: "Estoque",
    summary: "Ruptura, excesso e valor parado por família.",
    status: "Em breve",
  },
  {
    name: "Vendas",
    summary: "Faturamento vs meta, pedidos e ticket médio.",
    status: "Em breve",
  },
  {
    name: "Margem",
    summary: "Margem bruta do período e piores produtos.",
    status: "Em breve",
  },
] as const;

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "4rem 1.5rem 5rem",
      }}
    >
      <p
        style={{
          margin: 0,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        Distribuição · Papel & Limpeza
      </p>
      <h1
        style={{
          margin: "0.75rem 0 0.5rem",
          fontSize: "clamp(2.5rem, 6vw, 4rem)",
          fontWeight: 650,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
        }}
      >
        StatusPro
      </h1>
      <p
        style={{
          margin: 0,
          maxWidth: "36rem",
          fontSize: "1.125rem",
          lineHeight: 1.5,
          color: "var(--muted)",
        }}
      >
        Cockpit diário com os KPIs que importam — sem poluição de BI. Fonte: FKN
        (SIFWin) + Neon.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "3rem",
        }}
      >
        {pillars.map((pillar) => (
          <article
            key={pillar.name}
            style={{
              border: "1px solid var(--border)",
              background: "color-mix(in srgb, var(--surface) 88%, transparent)",
              padding: "1.25rem",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "0.5rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
                {pillar.name}
              </h2>
              <span style={{ fontSize: 12, color: "var(--accent)" }}>
                {pillar.status}
              </span>
            </div>
            <p
              style={{
                margin: "0.65rem 0 0",
                fontSize: 14,
                lineHeight: 1.45,
                color: "var(--muted)",
              }}
            >
              {pillar.summary}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
