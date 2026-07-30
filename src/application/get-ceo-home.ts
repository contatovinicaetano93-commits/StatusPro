import {
  getFreshness,
  getLatestBriefing,
  getLatestKpis,
  getOpenAlerts,
  getOrganizationById,
  getStockoutSkus,
  getTopOverdueCustomers,
} from "@/infrastructure/db/repositories";
import type { AlertItem, Freshness, Horizon, OrgContext } from "@/domain/types";
import { defaultSuggestedActions, rankAlerts } from "@/domain/alerts/rank";
import { explainKpiDeviation } from "@/ai/tools";
import { requireTenant } from "@/application/require-tenant";

export type RankedAlertView = AlertItem & {
  explanation: string | null;
  actions: string[];
};

export type CeoHomeView = {
  org: OrgContext | null;
  kpis: Awaited<ReturnType<typeof getLatestKpis>>;
  alerts: AlertItem[];
  rankedAlerts: RankedAlertView[];
  briefing: Awaited<ReturnType<typeof getLatestBriefing>>;
  freshness: Freshness;
  stockouts: Awaited<ReturnType<typeof getStockoutSkus>>;
  overdueCustomers: Awaited<ReturnType<typeof getTopOverdueCustomers>>;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

export async function getCeoHome(
  horizon: Horizon = "daily",
  organizationId?: string,
): Promise<CeoHomeView> {
  let org: OrgContext | null = null;

  if (organizationId) {
    org = await getOrganizationById(organizationId);
  } else {
    const tenant = await requireTenant();
    org = tenant.org;
  }

  if (!org) {
    return emptyHome();
  }

  const [kpis, alerts, briefing, freshness, stockouts, overdueCustomers] = await Promise.all([
    getLatestKpis(org.id, horizon),
    getOpenAlerts(org.id),
    getLatestBriefing(org.id),
    getFreshness(org.id),
    getStockoutSkus(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  const rankedAlerts = rankAlerts(alerts).map((a) => {
    const related = kpis.find((k) => k.kpiId === a.kpiId);
    const explanation =
      related && a.kpiId
        ? explainKpiDeviation({
            kpiId: a.kpiId,
            value: related.value,
            target: related.target,
            band: related.band,
            relatedAlerts: [a],
          }).summary
        : null;
    return {
      ...a,
      explanation,
      actions: defaultSuggestedActions(a),
    };
  });

  return {
    org,
    kpis,
    alerts,
    rankedAlerts,
    briefing,
    freshness,
    stockouts,
    overdueCustomers,
    checklist: defaultChecklist(alerts.length, stockouts.length),
  };
}

function emptyHome(): CeoHomeView {
  return {
    org: null,
    kpis: [],
    alerts: [],
    rankedAlerts: [],
    briefing: null,
    freshness: { asOf: null, ageMinutes: null, quality: "error", source: null },
    stockouts: [],
    overdueCustomers: [],
    checklist: defaultChecklist(),
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
