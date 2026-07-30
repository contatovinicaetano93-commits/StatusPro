import {
  getFreshness,
  getLatestKpis,
  getStockoutSkus,
} from "@/infrastructure/db/repositories";
import { resolveOrg } from "@/application/resolve-org";
import type { BandedKpi } from "@/application/get-ceo-home";
import type { Freshness, OrgContext } from "@/domain/types";

export type InventoryBoardView = {
  org: OrgContext | null;
  freshness: Freshness;
  stockoutKpi: BandedKpi | null;
  stockouts: Awaited<ReturnType<typeof getStockoutSkus>>;
};

export async function getInventoryBoard(organizationId?: string): Promise<InventoryBoardView> {
  const org = await resolveOrg(organizationId);
  if (!org) {
    return {
      org: null,
      freshness: { asOf: null, ageMinutes: null, quality: "error", source: null },
      stockoutKpi: null,
      stockouts: [],
    };
  }

  const [daily, freshness, stockouts] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getFreshness(org.id),
    getStockoutSkus(org.id),
  ]);

  return {
    org,
    freshness,
    stockoutKpi: daily.find((k) => k.kpiId === "stockout_sku_a") ?? null,
    stockouts,
  };
}
