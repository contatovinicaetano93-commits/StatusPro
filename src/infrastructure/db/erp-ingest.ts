import pg from "pg";
import { getEnv } from "@/lib/env";
import { getSql } from "@/infrastructure/db/client";
import type { ErpPullResult } from "@/infrastructure/erp/gateway";
import type { OperationalAlertDraft } from "@/domain/alerts/schemas";
import type { RecomputeSnapshot } from "@/domain/kpis/recompute";
import { logger } from "@/lib/logger";

const DEFAULT_UFS = ["SP", "RJ", "MG", "PR", "RS", "BA", "GO", "SC", "PE", "DF"] as const;

export function paymentExternalId(p: {
  customerExternalId: string;
  paymentDate: string;
  amountBrl: number;
}): string {
  return `pay:${p.customerExternalId}:${p.paymentDate}:${p.amountBrl.toFixed(2)}`;
}

export function freightExternalId(f: {
  costDate: string;
  uf: string;
  amountBrl: number;
  orderExternalId?: string;
}): string {
  return `frt:${f.costDate}:${f.uf}:${f.amountBrl.toFixed(2)}:${f.orderExternalId ?? "none"}`;
}

/** Keep transactional DB lean; KPI recompute still uses the full pull in memory. */
export function slimPullForPersist(pull: ErpPullResult, keepDays = 21): ErpPullResult {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return {
    ...pull,
    invoices: pull.invoices.filter((i) => i.invoiceDate >= cutoffIso),
    orders: pull.orders.filter((o) => o.orderDate >= cutoffIso),
    freight: pull.freight.filter((f) => f.costDate >= cutoffIso),
    payments: pull.payments.filter((p) => p.paymentDate >= cutoffIso),
    receivables: pull.receivables.slice(0, 400),
  };
}

async function withPg<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: getEnv().DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function batchUpsert(
  client: pg.Client,
  prefix: string,
  conflictSql: string,
  rows: unknown[][],
  cols: number,
): Promise<number> {
  if (!rows.length) return 0;
  const chunkSize = 80;
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, rowIdx) => {
      const base = rowIdx * cols;
      row.forEach((v) => values.push(v));
      return `(${Array.from({ length: cols }, (_, c) => `$${base + c + 1}`).join(",")})`;
    });
    await client.query(`${prefix} ${placeholders.join(",")} ${conflictSql}`, values);
    ok += chunk.length;
  }
  return ok;
}

export type IngestCounts = { ok: number; error: number };

export async function ensureDefaultWarehouse(organizationId: string): Promise<string> {
  return withPg(async (client) => {
    const existing = await client.query(
      `SELECT id FROM warehouses WHERE organization_id = $1 AND code = 'CD-SP' LIMIT 1`,
      [organizationId],
    );
    if (existing.rows[0]) return String(existing.rows[0].id);

    const inserted = await client.query(
      `INSERT INTO warehouses (organization_id, code, name, uf)
       VALUES ($1, 'CD-SP', 'CD São Paulo', 'SP')
       ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [organizationId],
    );
    return String(inserted.rows[0].id);
  });
}

export async function ensureRegions(
  organizationId: string,
  ufs: string[],
): Promise<Map<string, string>> {
  return withPg(async (client) => {
    const map = new Map<string, string>();
    const codes = [...new Set([...DEFAULT_UFS, ...ufs])];
    for (const uf of codes) {
      const rows = await client.query(
        `INSERT INTO regions (organization_id, code, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code`,
        [organizationId, uf, `Região ${uf}`],
      );
      map.set(String(rows.rows[0].code), String(rows.rows[0].id));
    }
    return map;
  });
}

export async function upsertErpMasters(
  organizationId: string,
  pull: ErpPullResult,
): Promise<{
  counts: IngestCounts;
  customerMap: Map<string, string>;
  productMap: Map<string, string>;
  warehouseId: string;
}> {
  const counts: IngestCounts = { ok: 0, error: 0 };
  const customerMap = new Map<string, string>();
  const productMap = new Map<string, string>();

  const warehouseId = await ensureDefaultWarehouse(organizationId);
  const regionMap = await ensureRegions(
    organizationId,
    pull.customers.map((c) => c.uf),
  );

  await withPg(async (client) => {
    for (const c of pull.customers) {
      try {
        const rows = await client.query(
          `INSERT INTO customers (
             organization_id, external_id, name, document, uf, region_id,
             segment, credit_limit_brl, is_national_account
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             name = EXCLUDED.name,
             document = EXCLUDED.document,
             uf = EXCLUDED.uf,
             region_id = EXCLUDED.region_id,
             segment = EXCLUDED.segment,
             credit_limit_brl = EXCLUDED.credit_limit_brl,
             is_national_account = EXCLUDED.is_national_account
           RETURNING id`,
          [
            organizationId,
            c.externalId,
            c.name,
            c.document ?? null,
            c.uf,
            regionMap.get(c.uf) ?? null,
            c.segment,
            c.creditLimitBrl,
            c.isNationalAccount,
          ],
        );
        customerMap.set(c.externalId, String(rows.rows[0].id));
        counts.ok += 1;
      } catch (err) {
        counts.error += 1;
        logger.warn("upsert customer failed", { externalId: c.externalId, err: String(err) });
      }
    }

    for (const p of pull.products) {
      try {
        const rows = await client.query(
          `INSERT INTO products (
             organization_id, sku, name, family, abc_class,
             unit_cost_brl, unit_price_brl, min_stock
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (organization_id, sku)
           DO UPDATE SET
             name = EXCLUDED.name,
             family = EXCLUDED.family,
             abc_class = EXCLUDED.abc_class,
             unit_cost_brl = EXCLUDED.unit_cost_brl,
             unit_price_brl = EXCLUDED.unit_price_brl,
             min_stock = EXCLUDED.min_stock
           RETURNING id`,
          [
            organizationId,
            p.sku,
            p.name,
            p.family,
            p.abcClass,
            p.unitCostBrl,
            p.unitPriceBrl,
            p.minStock,
          ],
        );
        productMap.set(p.sku, String(rows.rows[0].id));
        counts.ok += 1;
      } catch (err) {
        counts.error += 1;
        logger.warn("upsert product failed", { sku: p.sku, err: String(err) });
      }
    }
  });

  return { counts, customerMap, productMap, warehouseId };
}

export async function upsertErpFacts(args: {
  organizationId: string;
  pull: ErpPullResult;
  customerMap: Map<string, string>;
  productMap: Map<string, string>;
  warehouseId: string;
}): Promise<IngestCounts> {
  const counts: IngestCounts = { ok: 0, error: 0 };
  const { organizationId, pull, customerMap, productMap, warehouseId } = args;

  try {
    await withPg(async (client) => {
      await client.query("BEGIN");
      try {
        const orderRows = pull.orders
          .map((o) => {
            const customerId = customerMap.get(o.customerExternalId);
            if (!customerId) return null;
            return [
              organizationId,
              o.externalId,
              customerId,
              o.orderDate,
              o.dueDate ?? null,
              o.status,
              o.uf,
              o.requestedLines,
              o.fulfilledLines,
              o.onTimeInFull,
              o.netAmountBrl,
              o.cogsBrl,
            ];
          })
          .filter((r): r is NonNullable<typeof r> => r != null);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO sales_orders (
             organization_id, external_id, customer_id, order_date, due_date, status, uf,
             requested_lines, fulfilled_lines, on_time_in_full, net_amount_brl, cogs_brl
           ) VALUES`,
          `ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             status = EXCLUDED.status,
             requested_lines = EXCLUDED.requested_lines,
             fulfilled_lines = EXCLUDED.fulfilled_lines,
             on_time_in_full = EXCLUDED.on_time_in_full,
             net_amount_brl = EXCLUDED.net_amount_brl,
             cogs_brl = EXCLUDED.cogs_brl`,
          orderRows,
          12,
        );
        counts.error += pull.orders.length - orderRows.length;

        const invoiceRows = pull.invoices
          .map((inv) => {
            const customerId = customerMap.get(inv.customerExternalId);
            if (!customerId) return null;
            return [
              organizationId,
              customerId,
              inv.invoiceDate,
              inv.netAmountBrl,
              inv.cogsBrl,
              inv.uf,
              inv.externalId,
            ];
          })
          .filter((r): r is NonNullable<typeof r> => r != null);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO invoices (
             organization_id, customer_id, invoice_date, net_amount_brl, cogs_brl, uf, external_id
           ) VALUES`,
          `ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             net_amount_brl = EXCLUDED.net_amount_brl,
             cogs_brl = EXCLUDED.cogs_brl,
             uf = EXCLUDED.uf,
             invoice_date = EXCLUDED.invoice_date`,
          invoiceRows,
          7,
        );
        counts.error += pull.invoices.length - invoiceRows.length;

        const receivableRows = pull.receivables
          .map((r) => {
            const customerId = customerMap.get(r.customerExternalId);
            if (!customerId) return null;
            return [
              organizationId,
              customerId,
              r.dueDate,
              r.openAmountBrl,
              r.status,
              r.externalId,
            ];
          })
          .filter((row): row is NonNullable<typeof row> => row != null);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO receivables (
             organization_id, customer_id, due_date, open_amount_brl, status, external_id
           ) VALUES`,
          `ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             open_amount_brl = EXCLUDED.open_amount_brl,
             status = EXCLUDED.status,
             due_date = EXCLUDED.due_date`,
          receivableRows,
          6,
        );
        counts.error += pull.receivables.length - receivableRows.length;

        const paymentRows = pull.payments
          .map((p) => {
            const customerId = customerMap.get(p.customerExternalId);
            if (!customerId) return null;
            return [
              organizationId,
              customerId,
              p.paymentDate,
              p.amountBrl,
              paymentExternalId(p),
            ];
          })
          .filter((r): r is NonNullable<typeof r> => r != null);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO payments (
             organization_id, customer_id, payment_date, amount_brl, external_id
           ) VALUES`,
          `ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET amount_brl = EXCLUDED.amount_brl`,
          paymentRows,
          5,
        );
        counts.error += pull.payments.length - paymentRows.length;

        const freightRows = pull.freight.map((f) => [
          organizationId,
          f.costDate,
          f.uf,
          f.amountBrl,
          freightExternalId(f),
        ]);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO freight_costs (
             organization_id, cost_date, uf, amount_brl, external_id
           ) VALUES`,
          `ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET amount_brl = EXCLUDED.amount_brl`,
          freightRows,
          5,
        );

        const stockRows = pull.stock
          .map((s) => {
            const productId = productMap.get(s.sku);
            if (!productId) return null;
            return [organizationId, warehouseId, productId, s.asOfDate, s.onHand];
          })
          .filter((r): r is NonNullable<typeof r> => r != null);

        counts.ok += await batchUpsert(
          client,
          `INSERT INTO stock_snapshots (
             organization_id, warehouse_id, product_id, as_of_date, on_hand
           ) VALUES`,
          `ON CONFLICT (organization_id, warehouse_id, product_id, as_of_date)
           DO UPDATE SET on_hand = EXCLUDED.on_hand`,
          stockRows,
          5,
        );
        counts.error += pull.stock.length - stockRows.length;

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  } catch (err) {
    logger.error("upsertErpFacts failed", { err: String(err) });
    counts.error += 1;
  }

  return counts;
}

export async function insertKpiSnapshots(args: {
  organizationId: string;
  source: string;
  snapshots: RecomputeSnapshot[];
}): Promise<void> {
  const sql = getSql();
  for (const s of args.snapshots) {
    await sql`
      INSERT INTO kpi_snapshots (
        organization_id, kpi_id, horizon, as_of, value, target_value, source, quality
      )
      VALUES (
        ${args.organizationId},
        ${s.kpiId},
        ${s.horizon},
        NOW(),
        ${s.value},
        ${s.target ?? null},
        ${args.source},
        'ok'
      )
    `;
  }
}

export async function replaceOpenOperationalAlerts(args: {
  organizationId: string;
  alerts: OperationalAlertDraft[];
}): Promise<void> {
  const sql = getSql();
  const kpiIds = args.alerts.map((a) => a.kpiId).filter((id): id is string => Boolean(id));

  if (kpiIds.length) {
    await sql`
      UPDATE alerts
      SET status = 'resolved'
      WHERE organization_id = ${args.organizationId}
        AND status = 'open'
        AND kpi_id = ANY(${kpiIds})
    `;
  }

  for (const a of args.alerts) {
    await sql`
      INSERT INTO alerts (
        organization_id, severity, title, detail, kpi_id, impact_brl, suggested_actions
      )
      VALUES (
        ${args.organizationId},
        ${a.severity},
        ${a.title},
        ${a.detail},
        ${a.kpiId ?? null},
        ${a.impactBrl ?? null},
        ${JSON.stringify(a.suggestedActions)}::jsonb
      )
    `;
  }
}

export function countPullRecords(pull: ErpPullResult): number {
  return (
    pull.customers.length +
    pull.products.length +
    pull.orders.length +
    pull.invoices.length +
    pull.receivables.length +
    pull.payments.length +
    pull.stock.length +
    pull.freight.length
  );
}
