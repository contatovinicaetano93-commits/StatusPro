import { ErpPullResultSchema, type ErpPullResult } from "@/infrastructure/erp/gateway";

/**
 * Map vendor JSON → StatusPro `ErpPullResult`.
 *
 * Until FKN publishes the real schema:
 * - If the payload already matches `ErpPullResult`, accept it (sandbox / contract tests).
 * - Otherwise throw with a clear next step for the mapper.
 *
 * When docs arrive: transform vendor fields here, then `ErpPullResultSchema.parse(...)`.
 */
export function mapFknPullToErpResult(raw: unknown): ErpPullResult {
  const direct = ErpPullResultSchema.safeParse(raw);
  if (direct.success) return direct.data;

  // Common envelope: { data: ErpPullResult }
  if (raw && typeof raw === "object" && "data" in raw) {
    const nested = ErpPullResultSchema.safeParse((raw as { data: unknown }).data);
    if (nested.success) return nested.data;
  }

  throw new Error(
    "FKN pull mapper: response shape is not ErpPullResult yet. " +
      "Implement field mapping in mapFknPullToErpResult once FKN API docs arrive.",
  );
}
