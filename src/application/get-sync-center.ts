import { getSyncRuns, type SyncRunRow } from "@/infrastructure/db/repositories";
import type { OrgContext } from "@/domain/types";
import { requireTenant } from "@/application/require-tenant";

export type SyncCenterView = {
  org: OrgContext | null;
  runs: SyncRunRow[];
};

export async function getSyncCenter(): Promise<SyncCenterView> {
  const { org } = await requireTenant();
  const runs = await getSyncRuns(org.id);
  return { org, runs };
}
