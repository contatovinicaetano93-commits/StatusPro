import path from "path";
import { config } from "dotenv";
import pg from "pg";
import { MockErpGateway } from "../src/infrastructure/erp/mock-gateway";
import { recomputeKpisFromPull } from "../src/domain/kpis/recompute";
import { buildOperationalAlerts } from "../src/domain/alerts/build-operational";

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
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  console.log(`pulled invoices=${pull.invoices.length}`);

  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - 21);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const invoices = pull.invoices.filter((i) => i.invoiceDate >= cutoffIso);
  const orders = pull.orders.filter((o) => o.orderDate >= cutoffIso);
  const freight = pull.freight.filter((f) => f.costDate >= cutoffIso);
  const payments = pull.payments.filter((p) => p.paymentDate >= cutoffIso);
  const receivables = pull.receivables.slice(0, 400);

  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM organizations WHERE slug = $1`, [ORG_SLUG]);

    const org = await client.query(
      `INSERT INTO organizations (slug, name, annual_revenue_target_brl)
       VALUES ($1, $2, $3) RETURNING id`,
      [ORG_SLUG, "Distribuidora Demo Limpeza & Papel", 100_000_000],
    );
    const orgId = org.rows[0].id as string;

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

    const wh = await client.query(
      `INSERT INTO warehouses (organization_id, code, name, uf) VALUES ($1,'CD-SP','CD São Paulo','SP') RETURNING id`,
      [orgId],
    );
    const warehouseId = wh.rows[0].id as string;

    const regionMap = new Map<string, string>();
    for (const uf of ["SP", "RJ", "MG", "PR", "RS", "BA", "GO", "SC", "PE", "DF"]) {
      const r = await client.query(
        `INSERT INTO regions (organization_id, code, name) VALUES ($1,$2,$3) RETURNING id`,
        [orgId, uf, `Região ${uf}`],
      );
      regionMap.set(uf, r.rows[0].id);
    }

    const customerMap = new Map<string, string>();
    for (const c of pull.customers) {
      const row = await client.query(
        `INSERT INTO customers (organization_id, external_id, name, document, uf, region_id, segment, credit_limit_brl, is_national_account)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          orgId,
          c.externalId,
          c.name,
          c.document ?? null,
          c.uf,
          regionMap.get(c.uf),
          c.segment,
          c.creditLimitBrl,
          c.isNationalAccount,
        ],
      );
      customerMap.set(c.externalId, row.rows[0].id);
    }

    const productMap = new Map<string, string>();
    for (const p of pull.products) {
      const row = await client.query(
        `INSERT INTO products (organization_id, sku, name, family, abc_class, unit_cost_brl, unit_price_brl, min_stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [orgId, p.sku, p.name, p.family, p.abcClass, p.unitCostBrl, p.unitPriceBrl, p.minStock],
      );
      productMap.set(p.sku, row.rows[0].id);
    }

    console.log("inserting facts…");
    await batchInsert(
      client,
      `INSERT INTO invoices (organization_id, customer_id, invoice_date, net_amount_brl, cogs_brl, uf, external_id) VALUES`,
      invoices.map((inv) => [
        orgId,
        customerMap.get(inv.customerExternalId),
        inv.invoiceDate,
        inv.netAmountBrl,
        inv.cogsBrl,
        inv.uf,
        inv.externalId,
      ]),
      7,
    );

    await batchInsert(
      client,
      `INSERT INTO sales_orders (organization_id, external_id, customer_id, order_date, due_date, status, uf, requested_lines, fulfilled_lines, on_time_in_full, net_amount_brl, cogs_brl) VALUES`,
      orders.map((o) => [
        orgId,
        o.externalId,
        customerMap.get(o.customerExternalId),
        o.orderDate,
        o.dueDate ?? null,
        o.status,
        o.uf,
        o.requestedLines,
        o.fulfilledLines,
        o.onTimeInFull,
        o.netAmountBrl,
        o.cogsBrl,
      ]),
      12,
    );

    await batchInsert(
      client,
      `INSERT INTO receivables (organization_id, customer_id, due_date, open_amount_brl, status, external_id) VALUES`,
      receivables.map((r) => [
        orgId,
        customerMap.get(r.customerExternalId),
        r.dueDate,
        r.openAmountBrl,
        r.status,
        r.externalId,
      ]),
      6,
    );

    await batchInsert(
      client,
      `INSERT INTO payments (organization_id, customer_id, payment_date, amount_brl, external_id) VALUES`,
      payments.map((p) => [
        orgId,
        customerMap.get(p.customerExternalId),
        p.paymentDate,
        p.amountBrl,
        `pay:${p.customerExternalId}:${p.paymentDate}:${p.amountBrl.toFixed(2)}`,
      ]),
      5,
    );

    await batchInsert(
      client,
      `INSERT INTO freight_costs (organization_id, cost_date, uf, amount_brl, external_id) VALUES`,
      freight.map((f) => [
        orgId,
        f.costDate,
        f.uf,
        f.amountBrl,
        `frt:${f.costDate}:${f.uf}:${f.amountBrl.toFixed(2)}:${f.orderExternalId ?? "none"}`,
      ]),
      5,
    );

    for (const s of pull.stock) {
      const productId = productMap.get(s.sku);
      if (!productId) continue;
      await client.query(
        `INSERT INTO stock_snapshots (organization_id, warehouse_id, product_id, as_of_date, on_hand)
         VALUES ($1,$2,$3,$4,$5)`,
        [orgId, warehouseId, productId, s.asOfDate, s.onHand],
      );
    }

    const { snapshots, metrics } = recomputeKpisFromPull(pull, {
      asOfDate: todayIso,
      annualRevenueTargetBrl: 100_000_000,
      source: "mock:sifwin",
    });

    for (const s of snapshots) {
      await client.query(
        `INSERT INTO kpi_snapshots (organization_id, kpi_id, horizon, as_of, value, target_value, source, quality)
         VALUES ($1,$2,$3,NOW(),$4,$5,'mock:sifwin','ok')`,
        [orgId, s.kpiId, s.horizon, s.value, s.target ?? null],
      );
    }

    const alerts = buildOperationalAlerts(metrics);
    for (const a of alerts) {
      await client.query(
        `INSERT INTO alerts (organization_id, severity, title, detail, kpi_id, impact_brl, suggested_actions)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          orgId,
          a.severity,
          a.title,
          a.detail,
          a.kpiId ?? null,
          a.impactBrl ?? null,
          JSON.stringify(a.suggestedActions),
        ],
      );
    }

    await client.query(
      `INSERT INTO sync_runs (organization_id, source, mode, status, finished_at, records_in, records_ok, records_error, latency_ms)
       VALUES ($1,'mock:sifwin','full','success',NOW(),$2,$2,0,120)`,
      [orgId, pull.invoices.length + pull.customers.length + pull.products.length],
    );

    await client.query(
      `INSERT INTO ai_briefings (organization_id, horizon, as_of_date, content_md, evidence, model)
       VALUES ($1,'daily',$2,$3,$4::jsonb,'rule-based-seed')`,
      [
        orgId,
        todayIso,
        [
          "## Briefing do dia",
          "",
          `- Faturamento do dia: R$ ${metrics.revenueDay.toFixed(0)}.`,
          `- Fill rate: ${(metrics.fillRateDay * 100).toFixed(1)}% — ${metrics.stockoutSkuA} SKUs A em risco.`,
          `- Caixa recebido: R$ ${metrics.cashInDay.toFixed(0)}; vencidos: R$ ${metrics.overdueAr.toFixed(0)}.`,
          "",
          "### Prioridades",
          "1. Reposição emergencial dos SKUs A em ruptura.",
          "2. Cobrança dos maiores títulos vencidos.",
          "3. Proteger OTIF das contas nacionais com pedidos liberados.",
        ].join("\n"),
        JSON.stringify([
          { kpiId: "revenue_day", value: metrics.revenueDay },
          { kpiId: "fill_rate_day", value: metrics.fillRateDay },
          { kpiId: "overdue_ar", value: metrics.overdueAr },
          { kpiId: "stockout_sku_a", value: metrics.stockoutSkuA },
        ]),
      ],
    );

    await client.query("COMMIT");
    console.log(
      `seed ok org=${orgId} invoicesStored=${invoices.length} revenueDay=${metrics.revenueDay.toFixed(0)}`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

async function batchInsert(
  client: pg.Client,
  prefix: string,
  rows: Array<Array<unknown>>,
  cols: number,
) {
  const clean = rows.filter((r) => r.every((v, idx) => (idx === 1 ? v != null : true)));
  const chunkSize = 80;
  for (let i = 0; i < clean.length; i += chunkSize) {
    const chunk = clean.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, rowIdx) => {
      const base = rowIdx * cols;
      row.forEach((v) => values.push(v));
      return `(${Array.from({ length: cols }, (_, c) => `$${base + c + 1}`).join(",")})`;
    });
    await client.query(`${prefix} ${placeholders.join(",")}`, values);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
