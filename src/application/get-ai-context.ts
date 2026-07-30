import { getLatestKpis, getOpenAlerts, getOrganizationById } from "@/infrastructure/db/repositories";
import { toRankedAlertView, type RankedAlertView } from "@/domain/alerts/to-ranked-view";
import type { BandedKpi } from "@/application/get-ceo-home";
import type { AlertItem, OrgContext } from "@/domain/types";

/** Slim AI context — tools fetch stockouts/overdue on demand. */
export type AiContextView = {
  org: OrgContext | null;
  kpis: BandedKpi[];
  alerts: AlertItem[];
  rankedAlerts: RankedAlertView[];
};

export async function getAiContext(organizationId: string): Promise<AiContextView> {
  const org = await getOrganizationById(organizationId);
  if (!org) {
    return { org: null, kpis: [], alerts: [], rankedAlerts: [] };
  }

  const [kpis, alerts] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getOpenAlerts(org.id, 100),
  ]);

  const ranked = toRankedAlertView(alerts, { kpis, limit: 12, withExplain: false });
  return {
    org,
    kpis,
    alerts: ranked,
    rankedAlerts: ranked,
  };
}
