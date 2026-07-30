import { FknSifwinErpGateway, MockErpGateway } from "@/infrastructure/erp/mock-gateway";
import type { ErpGateway } from "@/infrastructure/erp/gateway";
import { getEnv } from "@/lib/env";

let cached: ErpGateway | null = null;

export function getErpGateway(): ErpGateway {
  if (cached) return cached;
  const mode = getEnv().ERP_MODE;
  cached = mode === "fkn" ? new FknSifwinErpGateway() : new MockErpGateway();
  return cached;
}
