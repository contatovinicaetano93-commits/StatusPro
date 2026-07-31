import { ingestErpPull } from "@/application/ingest-erp-pull";
import { getErpGateway } from "@/infrastructure/erp";
import { ErpPullResultSchema } from "@/infrastructure/erp/gateway";
import {
  getOrganizationById,
  insertSyncRun,
  isErpCircuitOpen,
} from "@/infrastructure/db/repositories";
import { logger } from "@/lib/logger";

export type RunErpSyncResult =
  | { ok: true; records: number; source: string; latencyMs: number }
  | { ok: false; error: string };

export async function runErpSync(organizationId: string): Promise<RunErpSyncResult> {
  const org = await getOrganizationById(organizationId);
  if (!org) return { ok: false, error: "Org ausente" };

  if (await isErpCircuitOpen(org.id)) {
    return {
      ok: false,
      error: "ERP em circuit breaker — aguarde ~5 min (3 falhas consecutivas em sync_runs).",
    };
  }

  const erp = getErpGateway();
  const started = Date.now();

  try {
    const health = await erp.healthcheck();
    if (!health.ok) {
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

    // Wide window; KPIs recompute from DB after upsert.
    const pullPromise = erp.pullIncremental(new Date(Date.now() - 120 * 86400000));
    const rawPull = await Promise.race([
      pullPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ERP pull timeout (45s)")), 45_000),
      ),
    ]);
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
      return { ok: false, error: "Ingest falhou sem registros ok" };
    }

    return { ok: true, records: ingest.recordsOk, source: erp.sourceName, latencyMs };
  } catch (err) {
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
