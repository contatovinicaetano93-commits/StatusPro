import { getCeoHome } from "@/application/get-ceo-home";
import { KPI_CATALOG } from "@/domain/kpis/catalog";
import type { RankedAlertView } from "@/application/get-ceo-home";

export type AlertsBoardView = {
  rankedAlerts: RankedAlertView[];
  playbooks: Array<{ id: string; name: string; steps: string[] }>;
};

export async function getAlertsBoard(): Promise<AlertsBoardView> {
  const home = await getCeoHome("daily");
  return {
    rankedAlerts: home.rankedAlerts,
    playbooks: KPI_CATALOG.filter((k) => k.playbook?.length).map((k) => ({
      id: k.id,
      name: k.name,
      steps: k.playbook ?? [],
    })),
  };
}
