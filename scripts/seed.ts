import path from "path";
import { config } from "dotenv";
import pg from "pg";
import { MockErpGateway } from "../src/infrastructure/erp/mock-gateway";
import { ingestErpPull } from "../src/application/ingest-erp-pull";

config({ path: path.resolve(process.cwd(), ".env") });

const ORG_SLUG = "distribuidora-demo";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("pulling mock erp…");
  const erp = new MockErpGateway(42);
  const pull = await erp.pullFull();
  console.log(`pulled invoices=${pull.invoices.length}`);

  await client.query("BEGIN");
  let orgId: string;
  try {
    await client.query(`DELETE FROM organizations WHERE slug = $1`, [ORG_SLUG]);

    const org = await client.query(
      `INSERT INTO organizations (slug, name, annual_revenue_target_brl)
       VALUES ($1, $2, $3) RETURNING id`,
      [ORG_SLUG, "Distribuidora Demo Limpeza & Papel", 100_000_000],
    );
    orgId = org.rows[0].id as string;

    const users = [
      ["ceo@statuspro.local", "Ana CEO", "ceo"],
      ["fin@statuspro.local", "Bruno Financeiro", "finance"],
      ["com@statuspro.local", "Carla Comercial", "commercial"],
      ["ops@statuspro.local", "Diego Operações", "operations"],
      ["admin@statuspro.local", "Eva Admin", "admin"],
    ] as const;
    for (const [email, name, role] of users) {
      await client.query(
        `INSERT INTO users (organization_id, email, name, role, password_hash) VALUES ($1,$2,$3,$4,'demo')`,
        [orgId, email, name, role],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }

  // Single ingest path shared with Sync Center (no duplicated KPI/alert SQL).
  const ingest = await ingestErpPull({
    organizationId: orgId!,
    annualRevenueTargetBrl: 100_000_000,
    pull,
    source: "mock:sifwin",
  });

  const briefingClient = new pg.Client({ connectionString: url });
  await briefingClient.connect();
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    await briefingClient.query(
      `INSERT INTO ai_briefings (organization_id, horizon, as_of_date, content_md, evidence, model)
       VALUES ($1,'daily',$2,$3,$4::jsonb,'rule-based-seed')`,
      [
        orgId!,
        todayIso,
        [
          "## Briefing do dia",
          "",
          "Dados carregados via `ingestErpPull` (mesmo pipeline do Sync Center).",
          "Abra o CEO Home e regenere o briefing com IA se a chave estiver configurada.",
        ].join("\n"),
        JSON.stringify([{ source: "seed", recordsOk: ingest.recordsOk }]),
      ],
    );
  } finally {
    await briefingClient.end();
  }

  console.log(
    `seed ok org=${orgId} recordsOk=${ingest.recordsOk} kpis=${ingest.kpiCount} alerts=${ingest.alertCount}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
