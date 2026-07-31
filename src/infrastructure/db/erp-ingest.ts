import pg from "pg";
import { getEnv } from "@/lib/env";
import { getSql } from "@/infrastructure/db/client";
import {
  ErpInvoiceSchema,
  ErpOrderSchema,
  ErpPaymentSchema,
  ErpReceivableSchema,
  ErpStockSchema,
  type ErpPullResult,
} from "@/infrastructure/erp/gateway";
import { OPERATIONAL_ALERT_KPI_IDS } from "@/domain/alerts/build-operational";
import type { OperationalAlertDraft } from "@/domain/alerts/schemas";
import type { RecomputePull, RecomputeSnapshot } from "@/domain/kpis/recompute";
import { logger } from "@/lib/logger";

type DeadLetterDraft = {
  entityType: string;
  payload: unknown;
  errorMessage: string;
};

async function insertDeadLettersInTxn(
  client: pg.Client,
  organizationId: string,
  drafts: DeadLetterDraft[],
): Promise<void> {
  for (const d of drafts) {
    await client.query(
      `INSERT INTO sync_dead_letters (
         organization_id, entity_type, payload, error_message
       ) VALUES ($1, $2, $3::jsonb, $4)`,
      [organizationId, d.entityType, JSON.stringify(d.payload), d.errorMessage],
    );
  }
}

async function resolveCustomerId(
  client: pg.Client,
  organizationId: string,
  customerExternalId: string,
): Promise<string | null> {
  const rows = await client.query(
    `SELECT id FROM customers
     WHERE organization_id = $1 AND external_id = $2
     LIMIT 1`,
    [organizationId, customerExternalId],
  );
  return rows.rows[0] ? String(rows.rows[0].id) : null;
}

async function resolveProductId(
  client: pg.Client,
  organizationId: string,
  sku: string,
): Promise<string | null> {
  const rows = await client.query(
    `SELECT id FROM products
     WHERE organization_id = $1 AND sku = $2
     LIMIT 1`,
    [organizationId, sku],
  );
  return rows.rows[0] ? String(rows.rows[0].id) : null;
}

async function resolveWarehouseId(
  client: pg.Client,
  organizationId: string,
  warehouseCode: string,
): Promise<string | null> {
  const rows = await client.query(
    `SELECT id FROM warehouses
     WHERE organization_id = $1 AND code = $2
     LIMIT 1`,
    [organizationId, warehouseCode],
  );
  return rows.rows[0] ? String(rows.rows[0].id) : null;
}

type RetryEntityType = "sales_order" | "invoice" | "receivable" | "payment" | "stock";

function asRetryEntityType(entityType: string): RetryEntityType | null {
  switch (entityType) {
    case "sales_order":
    case "invoice":
    case "receivable":
    case "payment":
    case "stock":
      return entityType;
    default:
      return null;
  }
}

/** Retry a single open dead-letter payload (orders / invoices / receivables / payments / stock). */
export async function retryDeadLetterUpsert(args: {
  organizationId: string;
  entityType: string;
  payload: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { organizationId, payload } = args;
  const entityType = asRetryEntityType(args.entityType);
  if (!entityType) {
    return { ok: false, error: `Tipo não suportado para retry: ${args.entityType}` };
  }

  try {
    return await withPg(async (client) => {
      await client.query("BEGIN");
      try {
        let softError: string | null = null;

        switch (entityType) {
          case "sales_order": {
            const o = ErpOrderSchema.parse(payload);
            const customerId = await resolveCustomerId(client, organizationId, o.customerExternalId);
            if (!customerId) {
              softError = `customer missing: ${o.customerExternalId}`;
              break;
            }
            await client.query(
              `INSERT INTO sales_orders (
                 organization_id, external_id, customer_id, order_date, due_date, status, uf,
                 requested_lines, fulfilled_lines, on_time_in_full, net_amount_brl, cogs_brl
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
               DO UPDATE SET
                 status = EXCLUDED.status,
                 requested_lines = EXCLUDED.requested_lines,
                 fulfilled_lines = EXCLUDED.fulfilled_lines,
                 on_time_in_full = EXCLUDED.on_time_in_full,
                 net_amount_brl = EXCLUDED.net_amount_brl,
                 cogs_brl = EXCLUDED.cogs_brl`,
              [
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
              ],
            );
            break;
          }
          case "invoice": {
            const inv = ErpInvoiceSchema.parse(payload);
            const customerId = await resolveCustomerId(
              client,
              organizationId,
              inv.customerExternalId,
            );
            if (!customerId) {
              softError = `customer missing: ${inv.customerExternalId}`;
              break;
            }
            await client.query(
              `INSERT INTO invoices (
                 organization_id, customer_id, invoice_date, net_amount_brl, cogs_brl, uf, external_id
               ) VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
               DO UPDATE SET
                 net_amount_brl = EXCLUDED.net_amount_brl,
                 cogs_brl = EXCLUDED.cogs_brl,
                 uf = EXCLUDED.uf,
                 invoice_date = EXCLUDED.invoice_date`,
              [
                organizationId,
                customerId,
                inv.invoiceDate,
                inv.netAmountBrl,
                inv.cogsBrl,
                inv.uf,
                inv.externalId,
              ],
            );
            break;
          }
          case "receivable": {
            const r = ErpReceivableSchema.parse(payload);
            const customerId = await resolveCustomerId(
              client,
              organizationId,
              r.customerExternalId,
            );
            if (!customerId) {
              softError = `customer missing: ${r.customerExternalId}`;
              break;
            }
            await client.query(
              `INSERT INTO receivables (
                 organization_id, customer_id, due_date, open_amount_brl, status, external_id
               ) VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
               DO UPDATE SET
                 open_amount_brl = EXCLUDED.open_amount_brl,
                 status = EXCLUDED.status,
                 due_date = EXCLUDED.due_date`,
              [
                organizationId,
                customerId,
                r.dueDate,
                r.openAmountBrl,
                r.status,
                r.externalId,
              ],
            );
            break;
          }
          case "payment": {
            const p = ErpPaymentSchema.parse(payload);
            const customerId = await resolveCustomerId(
              client,
              organizationId,
              p.customerExternalId,
            );
            if (!customerId) {
              softError = `customer missing: ${p.customerExternalId}`;
              break;
            }
            await client.query(
              `INSERT INTO payments (
                 organization_id, customer_id, payment_date, amount_brl, external_id
               ) VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL
               DO UPDATE SET amount_brl = EXCLUDED.amount_brl`,
              [
                organizationId,
                customerId,
                p.paymentDate,
                p.amountBrl,
                paymentExternalId(p),
              ],
            );
            break;
          }
          case "stock": {
            const s = ErpStockSchema.parse(payload);
            const productId = await resolveProductId(client, organizationId, s.sku);
            if (!productId) {
              softError = `product missing: ${s.sku}`;
              break;
            }
            const warehouseId = await resolveWarehouseId(
              client,
              organizationId,
              s.warehouseCode,
            );
            if (!warehouseId) {
              softError = `warehouse missing: ${s.warehouseCode}`;
              break;
            }
            await client.query(
              `INSERT INTO stock_snapshots (
                 organization_id, warehouse_id, product_id, as_of_date, on_hand
               ) VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (organization_id, warehouse_id, product_id, as_of_date)
               DO UPDATE SET on_hand = EXCLUDED.on_hand`,
              [organizationId, warehouseId, productId, s.asOfDate, s.onHand],
            );
            break;
          }
          default: {
            const _exhaustive: never = entityType;
            return { ok: false as const, error: `Tipo não suportado: ${String(_exhaustive)}` };
          }
        }

        if (softError) {
          await client.query("ROLLBACK");
          return { ok: false as const, error: softError };
        }

        await client.query("COMMIT");
        return { ok: true as const };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

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

/** Keep enough history for monthly KPIs when recomputing from DB. */
export function slimPullForPersist(pull: ErpPullResult, keepDays = 120): ErpPullResult {
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
        const deadLetters: DeadLetterDraft[] = [];

        const orderRows = pull.orders
          .map((o) => {
            const customerId = customerMap.get(o.customerExternalId);
            if (!customerId) {
              deadLetters.push({
                entityType: "sales_order",
                payload: o,
                errorMessage: `customer missing: ${o.customerExternalId}`,
              });
              return null;
            }
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
            if (!customerId) {
              deadLetters.push({
                entityType: "invoice",
                payload: inv,
                errorMessage: `customer missing: ${inv.customerExternalId}`,
              });
              return null;
            }
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
            if (!customerId) {
              deadLetters.push({
                entityType: "receivable",
                payload: r,
                errorMessage: `customer missing: ${r.customerExternalId}`,
              });
              return null;
            }
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
            if (!customerId) {
              deadLetters.push({
                entityType: "payment",
                payload: p,
                errorMessage: `customer missing: ${p.customerExternalId}`,
              });
              return null;
            }
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
            if (!productId) {
              deadLetters.push({
                entityType: "stock",
                payload: s,
                errorMessage: `product missing: ${s.sku}`,
              });
              return null;
            }
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

        await insertDeadLettersInTxn(client, organizationId, deadLetters);

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
  quality?: "ok" | "stale" | "partial" | "error";
}): Promise<void> {
  const sql = getSql();
  const quality = args.quality ?? "ok";
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
        ${quality}
      )
    `;
  }
}

export async function replaceOpenOperationalAlerts(args: {
  organizationId: string;
  alerts: OperationalAlertDraft[];
}): Promise<void> {
  const sql = getSql();
  // Always clear the managed set so green KPIs do not leave stale open alerts.
  const managedIds = [...OPERATIONAL_ALERT_KPI_IDS];
  await sql`
    UPDATE alerts
    SET status = 'resolved'
    WHERE organization_id = ${args.organizationId}
      AND status = 'open'
      AND kpi_id = ANY(${managedIds})
  `;

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

/** Build RecomputePull from persisted facts (production KPI path). */
export async function loadRecomputePullFromDb(organizationId: string): Promise<RecomputePull> {
  return withPg(async (client) => {
    const customers = await client.query(
      `SELECT external_id FROM customers WHERE organization_id = $1 AND external_id IS NOT NULL`,
      [organizationId],
    );
    const products = await client.query(
      `SELECT sku, abc_class, unit_cost_brl, min_stock FROM products WHERE organization_id = $1`,
      [organizationId],
    );
    const orders = await client.query(
      `SELECT order_date, requested_lines, fulfilled_lines, on_time_in_full
       FROM sales_orders WHERE organization_id = $1`,
      [organizationId],
    );
    const invoices = await client.query(
      `SELECT c.external_id AS customer_external_id, i.invoice_date, i.net_amount_brl, i.cogs_brl
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.organization_id = $1 AND c.external_id IS NOT NULL`,
      [organizationId],
    );
    const receivables = await client.query(
      `SELECT due_date, open_amount_brl, status FROM receivables WHERE organization_id = $1`,
      [organizationId],
    );
    const payments = await client.query(
      `SELECT payment_date, amount_brl FROM payments WHERE organization_id = $1`,
      [organizationId],
    );
    const freight = await client.query(
      `SELECT cost_date, amount_brl FROM freight_costs WHERE organization_id = $1`,
      [organizationId],
    );
    const stock = await client.query(
      `SELECT DISTINCT ON (p.sku) p.sku, s.on_hand
       FROM stock_snapshots s
       JOIN products p ON p.id = s.product_id
       WHERE s.organization_id = $1
       ORDER BY p.sku, s.as_of_date DESC`,
      [organizationId],
    );

    const toIso = (v: unknown) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).slice(0, 10);
    };

    return {
      customers: customers.rows.map((r) => ({ externalId: String(r.external_id) })),
      products: products.rows.map((r) => ({
        sku: String(r.sku),
        abcClass: r.abc_class as "A" | "B" | "C",
        unitCostBrl: Number(r.unit_cost_brl),
        minStock: Number(r.min_stock),
      })),
      orders: orders.rows.map((r) => ({
        orderDate: toIso(r.order_date),
        requestedLines: Number(r.requested_lines),
        fulfilledLines: Number(r.fulfilled_lines),
        onTimeInFull: r.on_time_in_full as boolean | null,
      })),
      invoices: invoices.rows.map((r) => ({
        customerExternalId: String(r.customer_external_id),
        invoiceDate: toIso(r.invoice_date),
        netAmountBrl: Number(r.net_amount_brl),
        cogsBrl: Number(r.cogs_brl),
      })),
      receivables: receivables.rows.map((r) => ({
        dueDate: toIso(r.due_date),
        openAmountBrl: Number(r.open_amount_brl),
        status: String(r.status),
      })),
      payments: payments.rows.map((r) => ({
        paymentDate: toIso(r.payment_date),
        amountBrl: Number(r.amount_brl),
      })),
      stock: stock.rows.map((r) => ({
        sku: String(r.sku),
        onHand: Number(r.on_hand),
      })),
      freight: freight.rows.map((r) => ({
        costDate: toIso(r.cost_date),
        amountBrl: Number(r.amount_brl),
      })),
    };
  });
}
