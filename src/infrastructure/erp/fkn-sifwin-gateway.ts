import type { ErpGateway, ErpPullResult } from "@/infrastructure/erp/gateway";
import { FknHttpError, fknFetchJson, getFknClientConfig } from "@/infrastructure/erp/fkn-http";
import { mapFknPullToErpResult } from "@/infrastructure/erp/fkn-map";

/**
 * Real FKN/SIFWin adapter.
 * Ready for credentials + HTTP; pull path/mapper finalize when vendor docs arrive.
 */
export class FknSifwinErpGateway implements ErpGateway {
  readonly sourceName = "fkn:sifwin";

  async healthcheck(): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    const config = getFknClientConfig();
    if (!config) {
      return {
        ok: false,
        latencyMs: 0,
        detail:
          "FKN credentials missing. Set ERP_FKN_BASE_URL and ERP_FKN_API_KEY (see .env.example).",
      };
    }

    const started = Date.now();
    try {
      await fknFetchJson(config, config.healthPath);
      return {
        ok: true,
        latencyMs: Date.now() - started,
        detail: `Reachable ${config.baseUrl}${config.healthPath}`,
      };
    } catch (err) {
      // 404 on health path still proves host/auth wiring for many APIs.
      if (err instanceof FknHttpError && err.status === 404) {
        return {
          ok: true,
          latencyMs: Date.now() - started,
          detail: `Host reachable (health path ${config.healthPath} returned 404 — adjust ERP_FKN_HEALTH_PATH).`,
        };
      }
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: String(err),
      };
    }
  }

  async pullFull(): Promise<ErpPullResult> {
    return this.pullIncremental(new Date(0));
  }

  async pullIncremental(since: Date): Promise<ErpPullResult> {
    const config = getFknClientConfig();
    if (!config) {
      throw new Error(
        "FknSifwinErpGateway: missing ERP_FKN_BASE_URL / ERP_FKN_API_KEY. Keep ERP_MODE=mock until configured.",
      );
    }

    const raw = await fknFetchJson(config, config.pullPath, {
      method: "GET",
      query: { since: since.toISOString() },
    });
    return mapFknPullToErpResult(raw);
  }
}
