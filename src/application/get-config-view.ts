import { KPI_CATALOG } from "@/domain/kpis/catalog";
import { ROLE_LABELS, ROLES } from "@/domain/roles";
import { getEnv, isFeatureEnabled } from "@/lib/env";

export type ConfigView = {
  appName: string;
  featureFlags: Array<{ id: string; enabled: boolean }>;
  featureFlagsRaw: string;
  roles: Array<{ id: string; label: string }>;
  kpis: Array<{
    id: string;
    name: string;
    horizon: string;
    unit: string;
    owner: string;
    formula: string;
  }>;
};

export async function getConfigView(): Promise<ConfigView> {
  const flags = ["ai_briefing", "ai_chat", "sync_center", "playbooks"] as const;
  const env = getEnv();
  return {
    appName: env.NEXT_PUBLIC_APP_NAME,
    featureFlags: flags.map((id) => ({ id, enabled: isFeatureEnabled(id) })),
    featureFlagsRaw: env.FEATURE_FLAGS,
    roles: ROLES.map((id) => ({ id, label: ROLE_LABELS[id] })),
    kpis: KPI_CATALOG.map((k) => ({
      id: k.id,
      name: k.name,
      horizon: k.horizon,
      unit: k.unit,
      owner: k.owner,
      formula: k.formula,
    })),
  };
}
