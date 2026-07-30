import { getLatestKpis, getOpenAlerts } from "@/infrastructure/db/repositories";
import { toRankedAlertView, type RankedAlertView } from "@/domain/alerts/to-ranked-view";
import { resolveOrg } from "@/application/resolve-org";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import type { BandedKpi } from "@/application/get-ceo-home";

export type AlertsBoardView = {
  rankedAlerts: RankedAlertView[];
  kpis: BandedKpi[];
  playbooks: Array<{ id: string; name: string; steps: string[] }>;
};

export async function getAlertsBoard(): Promise<AlertsBoardView> {
  const org = await resolveOrg();
  if (!org) {
    return { rankedAlerts: [], kpis: [], playbooks: [] };
  }

  const [kpis, alerts] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getOpenAlerts(org.id, 100),
  ]);

  return {
    kpis,
    rankedAlerts: toRankedAlertView(alerts, { kpis, limit: 20, withExplain: true }),
    playbooks: KPI_CATALOG.filter((k) => k.playbook?.length).map((k) => ({
      id: k.id,
      name: k.name,
      steps: k.playbook ?? [],
    })),
  };
}
