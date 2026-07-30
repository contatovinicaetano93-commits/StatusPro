import {
  getFreshness,
  getLatestKpis,
  getTopOverdueCustomers,
} from "@/infrastructure/db/repositories";
import { resolveOrg } from "@/application/resolve-org";
import type { BandedKpi } from "@/application/get-ceo-home";
import { formatKpiValue, getKpiDefinition } from "@/domain/kpis/engine";
import type { Freshness, OrgContext } from "@/domain/types";

export type CashOverdueCustomer = {
  name: string;
  uf: string;
  isNationalAccount: boolean;
  openAmountBrl: number;
  openAmountFormatted: string;
};

export type CashBoardView = {
  org: OrgContext | null;
  freshness: Freshness;
  kpis: BandedKpi[];
  overdueCustomers: CashOverdueCustomer[];
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

  const [daily, weekly, freshness, overdueRows] = await Promise.all([
    getLatestKpis(org.id, "daily"),
    getLatestKpis(org.id, "weekly"),
    getFreshness(org.id),
    getTopOverdueCustomers(org.id),
  ]);

  const overdueDef = getKpiDefinition("overdue_ar");
  const allow = new Set(["cash_in_day", "overdue_ar", "ar_aging_60"]);

  return {
    org,
    freshness,
    kpis: [...daily, ...weekly].filter((k) => allow.has(k.kpiId)),
    overdueCustomers: overdueRows.map((c) => {
      const amount = Number(c.open_amount);
      return {
        name: String(c.name),
        uf: String(c.uf),
        isNationalAccount: Boolean(c.is_national_account),
        openAmountBrl: amount,
        openAmountFormatted: overdueDef
          ? formatKpiValue(overdueDef, amount)
          : amount.toLocaleString("pt-BR"),
      };
    }),
  };
}
