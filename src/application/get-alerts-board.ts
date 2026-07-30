import { getRankedAlertsBoard, type RankedAlertView } from "@/application/get-ceo-home";
import { KPI_CATALOG } from "@/domain/kpis/catalog";

export type AlertsBoardView = {
  rankedAlerts: RankedAlertView[];
  playbooks: Array<{ id: string; name: string; steps: string[] }>;
};

export async function getAlertsBoard(): Promise<AlertsBoardView> {
  const board = await getRankedAlertsBoard();
  return {
    rankedAlerts: board.rankedAlerts,
    playbooks: KPI_CATALOG.filter((k) => k.playbook?.length).map((k) => ({
      id: k.id,
      name: k.name,
      steps: k.playbook ?? [],
    })),
  };
}
