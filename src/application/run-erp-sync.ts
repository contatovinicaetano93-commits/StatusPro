import { getErpGateway } from "@/infrastructure/erp";
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

    const pull = await erp.pullIncremental(new Date(Date.now() - 86400000));
    const latencyMs = Date.now() - started;
    // Ingest completo (upsert fatos + recompute KPIs) fica para o próximo corte;
    // aqui o use-case já centraliza o pipeline e registra o sync run via repo.
    await insertSyncRun({
      organizationId: org.id,
      source: erp.sourceName,
      mode: "incremental",
      status: "success",
      recordsIn: pull.invoices.length,
      recordsOk: pull.invoices.length,
      recordsError: 0,
      latencyMs,
    });
    erpBreaker.success();
    return { ok: true, records: pull.invoices.length, source: erp.sourceName, latencyMs };
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
