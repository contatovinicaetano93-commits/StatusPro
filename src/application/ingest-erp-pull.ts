import { buildOperationalAlerts } from "@/domain/alerts/build-operational";
import { recomputeKpisFromPull } from "@/domain/kpis/recompute";
import {
  countPullRecords,
  insertKpiSnapshots,
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

  // Recompute from the full pull so weekly/monthly KPIs stay realistic.
  const recompute = recomputeKpisFromPull(args.pull, {
    asOfDate,
    annualRevenueTargetBrl: args.annualRevenueTargetBrl,
    source: args.source,
  });

  await insertKpiSnapshots({
    organizationId: args.organizationId,
    source: args.source,
    snapshots: recompute.snapshots,
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
  });

  return {
    recordsIn,
    recordsOk,
    recordsError,
    kpiCount: recompute.snapshots.length,
    alertCount: alerts.length,
  };
}
