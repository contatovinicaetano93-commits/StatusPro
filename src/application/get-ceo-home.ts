import {
  getFreshness,
  getLatestBriefing,
  getLatestKpis,
  getOpenAlerts,
  getOrganizationBySlug,
  getStockoutSkus,
  getTopOverdueCustomers,
} from "@/infrastructure/db/repositories";
import type { Horizon } from "@/domain/types";
import { getEnv } from "@/lib/env";

export async function getCeoHome(horizon: Horizon = "daily") {
  const slug = getEnv().NEXT_PUBLIC_DEFAULT_ORG_SLUG;
  const org = await getOrganizationBySlug(slug);
  if (!org) {
    return {
      org: null,
      kpis: [],
      alerts: [],
      briefing: null,
      freshness: { asOf: null, ageMinutes: null, quality: "error" as const, source: null },
      stockouts: [],
      overdueCustomers: [],
      checklist: defaultChecklist(),
    };
  }

  const [kpis, alerts, briefing, freshness, stockouts, overdueCustomers] = await Promise.all([
    getLatestKpis(org.id, horizon),
    getOpenAlerts(org.id),
    getLatestBriefing(org.id),
    getFreshness(org.id),
    getStockoutSkus(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  return {
    org,
    kpis,
    alerts,
    briefing,
    freshness,
    stockouts,
    overdueCustomers,
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
