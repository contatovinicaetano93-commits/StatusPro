import {
  getFreshness,
  getLatestBriefing,
  getLatestKpis,
  getOpenAlerts,
  getStockoutSkus,
} from "@/infrastructure/db/repositories";
import { toRankedAlertView, type RankedAlertView } from "@/domain/alerts/to-ranked-view";
import { resolveOrg } from "@/application/resolve-org";
import type { Freshness, Horizon, OrgContext } from "@/domain/types";

export type BandedKpi = Awaited<ReturnType<typeof getLatestKpis>>[number];
export type { RankedAlertView };

export type CeoHomeView = {
  org: OrgContext | null;
  kpis: BandedKpi[];
  rankedAlerts: RankedAlertView[];
  briefing: Awaited<ReturnType<typeof getLatestBriefing>>;
  freshness: Freshness;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

/** CEO pulse only — stockouts/overdue live on dedicated boards. */
export async function getCeoHome(
  horizon: Horizon = "daily",
  organizationId?: string,
): Promise<CeoHomeView> {
  const org = await resolveOrg(organizationId);
  if (!org) {
    return {
      org: null,
      kpis: [],
      rankedAlerts: [],
      briefing: null,
      freshness: { asOf: null, ageMinutes: null, quality: "error", source: null },
      checklist: defaultChecklist(),
    };
  }

  const [kpis, alerts, briefing, freshness, stockouts] = await Promise.all([
    getLatestKpis(org.id, horizon),
    getOpenAlerts(org.id, 100),
    getLatestBriefing(org.id),
    getFreshness(org.id),
    getStockoutSkus(org.id),
  ]);

  return {
    org,
    kpis,
    rankedAlerts: toRankedAlertView(alerts, { kpis, limit: 8, withExplain: true }),
    briefing,
    freshness,
    checklist: defaultChecklist(alerts.length, stockouts.length),
  };
}

function defaultChecklist(alertCount = 0, stockouts = 0) {
  return [
    { id: "1", label: "Ler briefing do dia e confirmar prioridades", done: false },
    { id: "2", label: "Checar caixa: recebidos vs vencidos críticos", done: false },
    { id: "3", label: `Revisar rupturas SKU A (${stockouts})`, done: stockouts === 0 },
    { id: "4", label: "Validar fill rate / OTIF das contas nacionais", done: false },
    { id: "5", label: "Olhar margem da semana por família", done: false },
    { id: "6", label: `Tratar alertas abertos (${alertCount})`, done: alertCount === 0 },
    { id: "7", label: "Confirmar freshness da sincronização ERP", done: false },
  ];
}
