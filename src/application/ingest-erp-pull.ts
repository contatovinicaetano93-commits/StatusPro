import {
  countPullRecords,
  slimPullForPersist,
  upsertErpFacts,
  upsertErpMasters,
} from "@/infrastructure/db/erp-ingest";
import type { ErpPullResult } from "@/infrastructure/erp/gateway";
import { recomputeOrgFromDb } from "@/application/recompute-org-from-db";
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
  const persistPull = slimPullForPersist(args.pull);

  const masters = await upsertErpMasters(args.organizationId, persistPull);
  const facts = await upsertErpFacts({
    organizationId: args.organizationId,
    pull: persistPull,
    customerMap: masters.customerMap,
    productMap: masters.productMap,
    warehouseId: masters.warehouseId,
  });

  const recomputed = await recomputeOrgFromDb({
    organizationId: args.organizationId,
    annualRevenueTargetBrl: args.annualRevenueTargetBrl,
    source: args.source,
    quality: facts.error > 0 ? "partial" : "ok",
    asOfDate: args.asOfDate,
  });

  const recordsOk = masters.counts.ok + facts.ok;
  const recordsError = masters.counts.error + facts.error;

  logger.info("ingestErpPull done", {
    organizationId: args.organizationId,
    recordsIn,
    recordsOk,
    recordsError,
    kpiCount: recomputed.kpiCount,
    alertCount: recomputed.alertCount,
    recomputeSource: "db",
  });

  return {
    recordsIn,
    recordsOk,
    recordsError,
    kpiCount: recomputed.kpiCount,
    alertCount: recomputed.alertCount,
  };
}
