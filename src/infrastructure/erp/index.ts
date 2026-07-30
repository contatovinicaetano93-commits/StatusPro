import { FknSifwinErpGateway, MockErpGateway } from "@/infrastructure/erp/mock-gateway";
import type { ErpGateway } from "@/infrastructure/erp/gateway";

let cached: ErpGateway | null = null;

export function getErpGateway(): ErpGateway {
  if (cached) return cached;
  // Product decision: default to mock until FKN API credentials exist.
  const mode = process.env.ERP_MODE ?? "mock";
  cached = mode === "fkn" ? new FknSifwinErpGateway() : new MockErpGateway();
  return cached;
}
