import { buildOperationalAlerts } from "@/domain/alerts/build-operational";
import { recomputeKpisFromPull } from "@/domain/kpis/recompute";
import {
  countPullRecords,
  insertKpiSnapshots,
  loadRecomputePullFromDb,
  replaceOpenOperationalAlerts,
  slimPullForPersist,
  upsertErpFacts,
  upsertErpMasters,
} from "@/infrastructure/db/erp-ingest";
import type { ErpPullResult } from "@/infrastructure/erp/gateway";
import { logger } from "@/lib/logger";

export type IngestErpPullResult = {
  recordsIn: number;
  recordsOk: number;
  recordsError: number;
  kpiCount: number;
  alertCount: number;
};

export async function ingestErpPull(args: {
  organizationId: string;
  annualRevenueTargetBrl: number;
  pull: ErpPullResult;
  source: string;
  asOfDate?: string;
}): Promise<IngestErpPullResult> {
  const recordsIn = countPullRecords(args.pull);
  const asOfDate = args.asOfDate ?? new Date().toISOString().slice(0, 10);
  const persistPull = slimPullForPersist(args.pull);

  const masters = await upsertErpMasters(args.organizationId, persistPull);
  const facts = await upsertErpFacts({
    organizationId: args.organizationId,
    pull: persistPull,
    customerMap: masters.customerMap,
    productMap: masters.productMap,
    warehouseId: masters.warehouseId,
  });

  // Production path: recompute from persisted facts (not the in-memory pull).
  const dbPull = await loadRecomputePullFromDb(args.organizationId);
  const recompute = recomputeKpisFromPull(dbPull, {
    asOfDate,
    annualRevenueTargetBrl: args.annualRevenueTargetBrl,
    source: args.source,
    quality: facts.error > 0 ? "partial" : "ok",
  });

  await insertKpiSnapshots({
    organizationId: args.organizationId,
    source: args.source,
    snapshots: recompute.snapshots,
    quality: facts.error > 0 ? "partial" : "ok",
  });

  const alerts = buildOperationalAlerts(recompute.metrics);
  await replaceOpenOperationalAlerts({
    organizationId: args.organizationId,
    alerts,
  });

  const recordsOk = masters.counts.ok + facts.ok;
  const recordsError = masters.counts.error + facts.error;

  logger.info("ingestErpPull done", {
    organizationId: args.organizationId,
    recordsIn,
    recordsOk,
    recordsError,
    kpiCount: recompute.snapshots.length,
    alertCount: alerts.length,
    recomputeSource: "db",
  });

  return {
    recordsIn,
    recordsOk,
    recordsError,
    kpiCount: recompute.snapshots.length,
    alertCount: alerts.length,
  };
}
