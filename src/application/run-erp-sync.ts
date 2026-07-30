import { ingestErpPull } from "@/application/ingest-erp-pull";
import { getErpGateway } from "@/infrastructure/erp";
import { ErpPullResultSchema } from "@/infrastructure/erp/gateway";
import { getOrganizationById, insertSyncRun } from "@/infrastructure/db/repositories";
import { logger } from "@/lib/logger";
import { CircuitBreaker } from "@/infrastructure/erp/circuit-breaker";

const erpBreaker = new CircuitBreaker(3, 30_000);

export type RunErpSyncResult =
  | { ok: true; records: number; source: string; latencyMs: number }
  | { ok: false; error: string };

export async function runErpSync(organizationId: string): Promise<RunErpSyncResult> {
  const org = await getOrganizationById(organizationId);
  if (!org) return { ok: false, error: "Org ausente" };

  if (!erpBreaker.canRequest()) {
    return { ok: false, error: "ERP em circuit breaker — aguarde o cooldown." };
  }

  const erp = getErpGateway();
  const started = Date.now();

  try {
    const health = await erp.healthcheck();
    if (!health.ok) {
      erpBreaker.failure();
      await insertSyncRun({
        organizationId: org.id,
        source: erp.sourceName,
        mode: "incremental",
        status: "failed",
        recordsIn: 0,
        recordsOk: 0,
        recordsError: 1,
        latencyMs: Date.now() - started,
        errorSummary: health.detail ?? "ERP unhealthy",
      });
      return { ok: false, error: health.detail ?? "ERP unhealthy" };
    }

    // Wide window so weekly/monthly KPI recompute from the pull stays realistic
    // until we aggregate from persisted facts in SQL.
    const rawPull = await erp.pullIncremental(new Date(Date.now() - 120 * 86400000));
    const pull = ErpPullResultSchema.parse(rawPull);
    const ingest = await ingestErpPull({
      organizationId: org.id,
      annualRevenueTargetBrl: org.annualRevenueTargetBrl,
      pull,
      source: erp.sourceName,
    });

    const latencyMs = Date.now() - started;
    const status =
      ingest.recordsError === 0 ? "success" : ingest.recordsOk > 0 ? "partial" : "failed";

    await insertSyncRun({
      organizationId: org.id,
      source: erp.sourceName,
      mode: "incremental",
      status,
      recordsIn: ingest.recordsIn,
      recordsOk: ingest.recordsOk,
      recordsError: ingest.recordsError,
      latencyMs,
      errorSummary:
        ingest.recordsError > 0
          ? `${ingest.recordsError} entidades falharam no upsert`
          : null,
    });

    if (status === "failed") {
      erpBreaker.failure();
      return { ok: false, error: "Ingest falhou sem registros ok" };
    }

    erpBreaker.success();
    return { ok: true, records: ingest.recordsOk, source: erp.sourceName, latencyMs };
  } catch (err) {
    erpBreaker.failure();
    logger.error("sync failed", { err: String(err) });
    await insertSyncRun({
      organizationId: org.id,
      source: erp.sourceName,
      mode: "incremental",
      status: "failed",
      recordsIn: 0,
      recordsOk: 0,
      recordsError: 1,
      latencyMs: Date.now() - started,
      errorSummary: String(err),
    }).catch(() => undefined);
    return { ok: false, error: String(err) };
  }
}
