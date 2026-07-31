import { buildOperationalAlerts } from "@/domain/alerts/build-operational";
import { recomputeKpisFromPull } from "@/domain/kpis/recompute";
import {
  insertKpiSnapshots,
  loadRecomputePullFromDb,
  replaceOpenOperationalAlerts,
} from "@/infrastructure/db/erp-ingest";
import type { KpiQuality } from "@/domain/types";
import { logger } from "@/lib/logger";

export type RecomputeOrgFromDbResult = {
  kpiCount: number;
  alertCount: number;
};

/** Shared path: facts already in DB → KPI snapshots + operational alerts. */
export async function recomputeOrgFromDb(args: {
  organizationId: string;
  annualRevenueTargetBrl: number;
  source: string;
  quality?: KpiQuality;
  asOfDate?: string;
}): Promise<RecomputeOrgFromDbResult> {
  const asOfDate = args.asOfDate ?? new Date().toISOString().slice(0, 10);
  const quality = args.quality ?? "ok";

  const dbPull = await loadRecomputePullFromDb(args.organizationId);
  const recompute = recomputeKpisFromPull(dbPull, {
    asOfDate,
    annualRevenueTargetBrl: args.annualRevenueTargetBrl,
    source: args.source,
    quality,
  });

  await insertKpiSnapshots({
    organizationId: args.organizationId,
    source: args.source,
    snapshots: recompute.snapshots,
    quality,
  });

  const alerts = buildOperationalAlerts(recompute.metrics);
  await replaceOpenOperationalAlerts({
    organizationId: args.organizationId,
    alerts,
  });

  logger.info("recomputeOrgFromDb done", {
    organizationId: args.organizationId,
    source: args.source,
    kpiCount: recompute.snapshots.length,
    alertCount: alerts.length,
  });

  return {
    kpiCount: recompute.snapshots.length,
    alertCount: alerts.length,
  };
}
