import {
  getFreshness,
  getLatestBriefing,
  getLatestKpis,
  getOpenAlerts,
  getOrganizationById,
  getStockoutSkus,
  getTopOverdueCustomers,
} from "@/infrastructure/db/repositories";
import { defaultSuggestedActions, rankAlerts } from "@/domain/alerts/rank";
import { explainKpiDeviation } from "@/domain/kpis/explain";
import { requireTenant } from "@/application/require-tenant";
import type { AlertItem, Freshness, Horizon, OrgContext } from "@/domain/types";

export type BandedKpi = Awaited<ReturnType<typeof getLatestKpis>>[number];

export type RankedAlertView = AlertItem & {
  explanation: string | null;
  actions: string[];
};

async function resolveOrg(organizationId?: string): Promise<OrgContext | null> {
  if (organizationId) return getOrganizationById(organizationId);
  const tenant = await requireTenant();
  return tenant.org;
}

function rankOpenAlerts(alerts: AlertItem[], limit = 8): RankedAlertView[] {
  return rankAlerts(alerts)
    .slice(0, limit)
    .map((a) => ({
      ...a,
      explanation: null,
      actions: defaultSuggestedActions(a),
    }));
}

function enrichRankedAlerts(
  alerts: AlertItem[],
  kpis: BandedKpi[],
  limit = 8,
): RankedAlertView[] {
  return rankAlerts(alerts)
    .slice(0, limit)
    .map((a) => {
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
}

export type CeoHomeView = {
  org: OrgContext | null;
  kpis: BandedKpi[];
  alerts: AlertItem[];
  rankedAlerts: RankedAlertView[];
  briefing: Awaited<ReturnType<typeof getLatestBriefing>>;
  freshness: Freshness;
  stockouts: Awaited<ReturnType<typeof getStockoutSkus>>;
  overdueCustomers: Awaited<ReturnType<typeof getTopOverdueCustomers>>;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

/** CEO pulse only — not for secondary boards. */
export async function getCeoHome(
  horizon: Horizon = "daily",
  organizationId?: string,
): Promise<CeoHomeView> {
  const org = await resolveOrg(organizationId);
  if (!org) return emptyHome();

  const [kpis, alerts, briefing, freshness, stockouts, overdueCustomers] = await Promise.all([
    getLatestKpis(org.id, horizon),
    getOpenAlerts(org.id, 100),
    getLatestBriefing(org.id),
    getFreshness(org.id),
    getStockoutSkus(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  return {
    org,
    kpis,
    alerts: rankAlerts(alerts).slice(0, 12),
    rankedAlerts: enrichRankedAlerts(alerts, kpis),
    briefing,
    freshness,
    stockouts,
    overdueCustomers,
    checklist: defaultChecklist(alerts.length, stockouts.length),
  };
}

export type KpiBoardView = {
  org: OrgContext | null;
  freshness: Freshness;
  kpis: BandedKpi[];
};

/** Multi-horizon KPI board without briefing/AI/stock/overdue fan-out. */
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

export type CashBoardView = {
  org: OrgContext | null;
  freshness: Freshness;
  kpis: BandedKpi[];
  overdueCustomers: Awaited<ReturnType<typeof getTopOverdueCustomers>>;
};

export async function getCashBoard(organizationId?: string): Promise<CashBoardView> {
  const org = await resolveOrg(organizationId);
  if (!org) {
    return {
      org: null,
      freshness: { asOf: null, ageMinutes: null, quality: "error", source: null },
      kpis: [],
      overdueCustomers: [],
    };
  }

  const [daily, weekly, freshness, overdueCustomers] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getLatestKpis(org.id, "weekly"),
    getFreshness(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  const allow = new Set(["cash_in_day", "overdue_ar", "ar_aging_60"]);
  return {
    org,
    freshness,
    kpis: [...daily, ...weekly].filter((k) => allow.has(k.kpiId)),
    overdueCustomers,
  };
}

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

export type AlertsOnlyView = {
  org: OrgContext | null;
  rankedAlerts: RankedAlertView[];
  kpis: BandedKpi[];
};

export async function getRankedAlertsBoard(organizationId?: string): Promise<AlertsOnlyView> {
  const org = await resolveOrg(organizationId);
  if (!org) return { org: null, rankedAlerts: [], kpis: [] };

  const [kpis, alerts] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getOpenAlerts(org.id, 100),
  ]);

  return {
    org,
    kpis,
    rankedAlerts: enrichRankedAlerts(alerts, kpis, 20),
  };
}

/** Slim context for AI ask/briefing — no stock table / overdue table unless needed. */
export type AiContextView = {
  org: OrgContext | null;
  kpis: BandedKpi[];
  alerts: AlertItem[];
  rankedAlerts: RankedAlertView[];
  stockouts: Awaited<ReturnType<typeof getStockoutSkus>>;
  overdueCustomers: Awaited<ReturnType<typeof getTopOverdueCustomers>>;
};

export async function getAiContext(organizationId: string): Promise<AiContextView> {
  const org = await getOrganizationById(organizationId);
  if (!org) {
    return { org: null, kpis: [], alerts: [], rankedAlerts: [], stockouts: [], overdueCustomers: [] };
  }

  const [kpis, alerts, stockouts, overdueCustomers] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getOpenAlerts(org.id, 100),
    getStockoutSkus(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  const ranked = rankOpenAlerts(alerts, 12);
  return {
    org,
    kpis,
    alerts: ranked,
    rankedAlerts: ranked,
    stockouts,
    overdueCustomers,
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
