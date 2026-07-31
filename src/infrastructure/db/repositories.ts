import { getSql } from "@/infrastructure/db/client";
import { listKpisByHorizon, withBand } from "@/domain/kpis/engine";
import { AlertItemSchema } from "@/domain/alerts/schemas";
import type { AlertItem, Freshness, Horizon, KpiQuality, KpiSnapshot, OrgContext } from "@/domain/types";
import { logger } from "@/lib/logger";

export type { Freshness, OrgContext };

function mapOrg(row: Record<string, unknown>): OrgContext {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    annualRevenueTargetBrl: Number(row.annual_revenue_target_brl ?? 100_000_000),
  };
}

export async function getOrganizationById(id: string): Promise<OrgContext | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, slug, name, annual_revenue_target_brl
      FROM organizations WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) return null;
    return mapOrg(rows[0] as Record<string, unknown>);
  } catch (err) {
    logger.warn("getOrganizationById failed", { err: String(err) });
    return null;
  }
}

export async function getOrganizationBySlug(slug: string): Promise<OrgContext | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, slug, name, annual_revenue_target_brl
      FROM organizations WHERE slug = ${slug} LIMIT 1
    `;
    if (!rows[0]) return null;
    return mapOrg(rows[0] as Record<string, unknown>);
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

export async function getOpenAlerts(orgId: string, limit = 100): Promise<AlertItem[]> {
  try {
    const sql = getSql();
    // Wide fetch — domain rankAlerts owns ordering + slice.
    const rows = await sql`
      SELECT id, severity, title, detail, kpi_id, impact_brl, suggested_actions, created_at
      FROM alerts
      WHERE organization_id = ${orgId} AND status = 'open'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.flatMap((r) => {
      const parsed = AlertItemSchema.safeParse({
        id: String(r.id),
        severity: r.severity,
        title: String(r.title),
        detail: String(r.detail),
        kpiId: r.kpi_id ? String(r.kpi_id) : undefined,
        impactBrl: r.impact_brl != null ? Number(r.impact_brl) : undefined,
        suggestedActions: Array.isArray(r.suggested_actions)
          ? (r.suggested_actions as string[])
          : [],
        createdAt: new Date(r.created_at as string).toISOString(),
      });
      return parsed.success ? [parsed.data] : [];
    });
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

export type SyncRunRow = {
  id: string;
  source: string;
  mode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  recordsIn: number;
  recordsOk: number;
  recordsError: number;
  errorSummary: string | null;
  latencyMs: number | null;
};

export async function getSyncRuns(orgId: string, limit = 20): Promise<SyncRunRow[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, source, mode, status, started_at, finished_at, records_in, records_ok, records_error, error_summary, latency_ms
      FROM sync_runs
      WHERE organization_id = ${orgId}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: String(r.id),
      source: String(r.source),
      mode: String(r.mode),
      status: String(r.status),
      startedAt: new Date(String(r.started_at)).toISOString(),
      finishedAt: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null,
      recordsIn: Number(r.records_in),
      recordsOk: Number(r.records_ok),
      recordsError: Number(r.records_error),
      errorSummary: r.error_summary ? String(r.error_summary) : null,
      latencyMs: r.latency_ms != null ? Number(r.latency_ms) : null,
    }));
  } catch {
    return [];
  }
}

export async function insertAiBriefing(input: {
  organizationId: string;
  horizon: string;
  asOfDate: string;
  contentMd: string;
  evidenceJson: string;
  model: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO ai_briefings (organization_id, horizon, as_of_date, content_md, evidence, model)
    VALUES (
      ${input.organizationId},
      ${input.horizon},
      ${input.asOfDate},
      ${input.contentMd},
      ${input.evidenceJson}::jsonb,
      ${input.model}
    )
  `;
}

export async function insertSyncRun(input: {
  organizationId: string;
  source: string;
  mode: "incremental" | "full";
  status: "running" | "success" | "partial" | "failed";
  recordsIn: number;
  recordsOk: number;
  recordsError: number;
  latencyMs: number;
  errorSummary?: string | null;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO sync_runs (
      organization_id, source, mode, status, finished_at,
      records_in, records_ok, records_error, latency_ms, error_summary
    )
    VALUES (
      ${input.organizationId},
      ${input.source},
      ${input.mode},
      ${input.status},
      NOW(),
      ${input.recordsIn},
      ${input.recordsOk},
      ${input.recordsError},
      ${input.latencyMs},
      ${input.errorSummary ?? null}
    )
  `;
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

export async function insertSyncDeadLetter(input: {
  organizationId: string;
  entityType: string;
  payload: unknown;
  errorMessage: string;
  syncRunId?: string | null;
}) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO sync_dead_letters (
        organization_id, sync_run_id, entity_type, payload, error_message
      )
      VALUES (
        ${input.organizationId},
        ${input.syncRunId ?? null},
        ${input.entityType},
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.errorMessage}
      )
    `;
  } catch (err) {
    logger.warn("insertSyncDeadLetter failed", { err: String(err) });
  }
}

export type SyncDeadLetterRow = {
  id: string;
  entityType: string;
  errorMessage: string;
  payloadPreview: string;
  createdAt: string;
};

export type SyncDeadLetterDetail = {
  id: string;
  organizationId: string;
  entityType: string;
  errorMessage: string;
  payload: unknown;
  createdAt: string;
};

function mapDeadLetterListRow(r: Record<string, unknown>): SyncDeadLetterRow {
  const payload = r.payload;
  const preview =
    typeof payload === "string"
      ? payload.slice(0, 160)
      : JSON.stringify(payload).slice(0, 160);
  return {
    id: String(r.id),
    entityType: String(r.entity_type),
    errorMessage: String(r.error_message),
    payloadPreview: preview,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

/** Open dead letters only (`reprocessed_at IS NULL`). */
export async function listSyncDeadLetters(
  orgId: string,
  limit = 20,
): Promise<SyncDeadLetterRow[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, entity_type, error_message, payload, created_at
      FROM sync_dead_letters
      WHERE organization_id = ${orgId}
        AND reprocessed_at IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => mapDeadLetterListRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getSyncDeadLetter(
  orgId: string,
  id: string,
): Promise<SyncDeadLetterDetail | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, organization_id, entity_type, error_message, payload, created_at
      FROM sync_dead_letters
      WHERE organization_id = ${orgId}
        AND id = ${id}
        AND reprocessed_at IS NULL
      LIMIT 1
    `;
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      organizationId: String(r.organization_id),
      entityType: String(r.entity_type),
      errorMessage: String(r.error_message),
      payload: r.payload,
      createdAt: new Date(String(r.created_at)).toISOString(),
    };
  } catch (err) {
    logger.warn("getSyncDeadLetter failed", { err: String(err) });
    return null;
  }
}

export async function markSyncDeadLetterReprocessed(
  orgId: string,
  id: string,
): Promise<boolean> {
  try {
    const sql = getSql();
    const rows = await sql`
      UPDATE sync_dead_letters
      SET reprocessed_at = NOW()
      WHERE organization_id = ${orgId}
        AND id = ${id}
        AND reprocessed_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    logger.warn("markSyncDeadLetterReprocessed failed", { err: String(err) });
    return false;
  }
}

/** Default cooldown: 5 minutes after a streak of consecutive failures. */
export const ERP_CIRCUIT_COOLDOWN_MS = 5 * 60_000;

/**
 * Persisted circuit via sync_runs: open when the last `threshold` runs are failed
 * and the newest failure is still inside cooldownMs. Survives serverless isolates.
 * Fail-closed: if we cannot read sync_runs, treat circuit as open.
 */
export async function isErpCircuitOpen(
  orgId: string,
  threshold = 3,
  cooldownMs = ERP_CIRCUIT_COOLDOWN_MS,
): Promise<boolean> {
  try {
    const runs = await getSyncRuns(orgId, threshold);
    if (runs.length < threshold) return false;
    const consecutiveFailed = runs.every((r) => r.status === "failed");
    if (!consecutiveFailed) return false;
    const newest = runs[0];
    if (!newest) return false;
    return Date.now() - new Date(newest.startedAt).getTime() < cooldownMs;
  } catch {
    return true;
  }
}

