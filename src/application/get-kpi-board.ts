import { getFreshness, getLatestKpis } from "@/infrastructure/db/repositories";
import { resolveOrg } from "@/application/resolve-org";
import type { BandedKpi } from "@/application/get-ceo-home";
import type { Freshness, Horizon, OrgContext } from "@/domain/types";

export type KpiBoardView = {
  org: OrgContext | null;
  freshness: Freshness;
  kpis: BandedKpi[];
};

export async function getKpiBoard(args: {
  horizons: Horizon[];
  kpiIds?: string[];
  organizationId?: string;
}): Promise<KpiBoardView> {
  const org = await resolveOrg(args.organizationId);
  if (!org) {
    return {
      org: null,
      freshness: { asOf: null, ageMinutes: null, quality: "error", source: null },
      kpis: [],
    };
  }

  const [freshness, ...horizonKpis] = await Promise.all([
    getFreshness(org.id),
    ...args.horizons.map((h) => getLatestKpis(org.id, h)),
  ]);

  let kpis = horizonKpis.flat();
  if (args.kpiIds?.length) {
    const allow = new Set(args.kpiIds);
    kpis = kpis.filter((k) => allow.has(k.kpiId));
  }

  return { org, freshness, kpis };
}
