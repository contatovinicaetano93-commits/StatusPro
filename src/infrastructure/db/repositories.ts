import { getSql } from "@/infrastructure/db/client";
import { listKpisByHorizon, withBand, getKpiDefinition } from "@/domain/kpis/engine";
import type { AlertItem, Horizon, KpiQuality, KpiSnapshot } from "@/domain/types";
import { logger } from "@/lib/logger";

export type Freshness = {
  asOf: string | null;
  ageMinutes: number | null;
  quality: KpiQuality;
  source: string | null;
};

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
};

export async function getOrganizationBySlug(slug: string): Promise<OrgContext | null> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, slug, name FROM organizations WHERE slug = ${slug} LIMIT 1`;
    if (!rows[0]) return null;
    return { id: rows[0].id as string, slug: rows[0].slug as string, name: rows[0].name as string };
  } catch (err) {
    logger.warn("getOrganizationBySlug failed", { err: String(err) });
    return null;
  }
}

export async function getLatestKpis(orgId: string, horizon: Horizon) {
  const defs = listKpisByHorizon(horizon);
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT DISTINCT ON (kpi_id)
        kpi_id, value, target_value, previous_value, as_of, source, quality, meta
      FROM kpi_snapshots
      WHERE organization_id = ${orgId} AND horizon = ${horizon}
      ORDER BY kpi_id, as_of DESC
    `;
    const byId = new Map(rows.map((r) => [r.kpi_id as string, r]));
    return defs.map((def) => {
      const row = byId.get(def.id);
      const snap: KpiSnapshot = row
        ? {
            kpiId: def.id,
            value: Number(row.value),
            target: row.target_value != null ? Number(row.target_value) : null,
            previous: row.previous_value != null ? Number(row.previous_value) : null,
            asOf: new Date(row.as_of as string).toISOString(),
            source: String(row.source),
            quality: row.quality as KpiQuality,
            meta: (row.meta as Record<string, unknown>) ?? {},
          }
        : {
            kpiId: def.id,
            value: 0,
            target: null,
            previous: null,
            asOf: new Date().toISOString(),
            source: "missing",
            quality: "error",
          };
      return withBand(def, snap);
    });
  } catch (err) {
    logger.error("getLatestKpis failed", { err: String(err) });
    return defs.map((def) =>
      withBand(def, {
        kpiId: def.id,
        value: 0,
        asOf: new Date().toISOString(),
        source: "error",
        quality: "error",
      }),
    );
  }
}

export async function getFreshness(orgId: string): Promise<Freshness> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT as_of, source, quality
      FROM kpi_snapshots
      WHERE organization_id = ${orgId}
      ORDER BY as_of DESC
      LIMIT 1
    `;
    if (!rows[0]) {
      return { asOf: null, ageMinutes: null, quality: "error", source: null };
    }
    const asOf = new Date(rows[0].as_of as string);
    const ageMinutes = Math.max(0, Math.round((Date.now() - asOf.getTime()) / 60000));
    let quality = rows[0].quality as KpiQuality;
    if (ageMinutes > 180 && quality === "ok") quality = "stale";
    return {
      asOf: asOf.toISOString(),
      ageMinutes,
      quality,
      source: String(rows[0].source),
    };
  } catch {
    return { asOf: null, ageMinutes: null, quality: "error", source: null };
  }
}

export async function getOpenAlerts(orgId: string, limit = 8): Promise<AlertItem[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, severity, title, detail, kpi_id, impact_brl, suggested_actions, created_at
      FROM alerts
      WHERE organization_id = ${orgId} AND status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: String(r.id),
      severity: r.severity as AlertItem["severity"],
      title: String(r.title),
      detail: String(r.detail),
      kpiId: r.kpi_id ? String(r.kpi_id) : undefined,
      impactBrl: r.impact_brl != null ? Number(r.impact_brl) : undefined,
      suggestedActions: Array.isArray(r.suggested_actions)
        ? (r.suggested_actions as string[])
        : [],
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  } catch (err) {
    logger.warn("getOpenAlerts failed", { err: String(err) });
    return [];
  }
}

export async function getLatestBriefing(orgId: string) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, content_md, evidence, model, as_of_date, created_at
      FROM ai_briefings
      WHERE organization_id = ${orgId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return {
      id: String(rows[0].id),
      contentMd: String(rows[0].content_md),
      evidence: rows[0].evidence,
      model: rows[0].model ? String(rows[0].model) : null,
      asOfDate: String(rows[0].as_of_date),
      createdAt: new Date(rows[0].created_at as string).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getSyncRuns(orgId: string, limit = 20) {
  try {
    const sql = getSql();
    return await sql`
      SELECT id, source, mode, status, started_at, finished_at, records_in, records_ok, records_error, error_summary, latency_ms
      FROM sync_runs
      WHERE organization_id = ${orgId}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export async function getStockoutSkus(orgId: string) {
  try {
    const sql = getSql();
    return await sql`
      SELECT p.sku, p.name, p.family, p.abc_class, p.min_stock, s.on_hand, w.code AS warehouse
      FROM stock_snapshots s
      JOIN products p ON p.id = s.product_id
      JOIN warehouses w ON w.id = s.warehouse_id
      WHERE s.organization_id = ${orgId}
        AND p.abc_class = 'A'
        AND s.on_hand < p.min_stock
      ORDER BY (p.min_stock - s.on_hand) DESC
      LIMIT 20
    `;
  } catch {
    return [];
  }
}

export async function getTopOverdueCustomers(orgId: string) {
  try {
    const sql = getSql();
    return await sql`
      SELECT c.name, c.uf, c.is_national_account, SUM(r.open_amount_brl)::float AS open_amount
      FROM receivables r
      JOIN customers c ON c.id = r.customer_id
      WHERE r.organization_id = ${orgId}
        AND r.status = 'open'
        AND r.due_date < CURRENT_DATE
      GROUP BY c.id
      ORDER BY open_amount DESC
      LIMIT 10
    `;
  } catch {
    return [];
  }
}

export function explainKpi(kpiId: string) {
  return getKpiDefinition(kpiId) ?? null;
}
