import { FknSifwinErpGateway } from "@/infrastructure/erp/fkn-sifwin-gateway";
import { MockErpGateway } from "@/infrastructure/erp/mock-gateway";
import type { ErpGateway } from "@/infrastructure/erp/gateway";
import { getEnv } from "@/lib/env";

let cached: ErpGateway | null = null;

export function getErpGateway(): ErpGateway {
  if (cached) return cached;
  const mode = getEnv().ERP_MODE;
  cached = mode === "fkn" ? new FknSifwinErpGateway() : new MockErpGateway();
  return cached;
}

/** Test helper — clears singleton between cases. */
export function resetErpGatewayCache(): void {
  cached = null;
}
